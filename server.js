const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');

const app = express();
const port = 3000;

app.get('/ping', (req, res) => {
    res.send('pong');
});

app.use(express.static(path.join(__dirname, 'build')));

app.get('/scrape', async (req, res) => {
    let vacationData = [];  // vacationData 변수를 초기화

    try {
        const browser = await puppeteer.launch({
        //args: ['--no-sandbox'],
        //executablePath: '/home/ubuntu/.cache/puppeteer/chrome/linux-119.0.6045.105/chrome-linux64/chrome',
        headless: false });

        const page = await browser.newPage();

        const loginUrl = 'https://papa.hr.crew-admin.papa-service.com/login?callbackUrl=https%3A%2F%2Fpapa.hr.crew-admin.papa-service.com%2F';

        await page.goto(loginUrl);

        // 아이디와 비밀번호 입력
        await page.type('#mui-2', '');
        await page.type('#mui-3', '');

        // 로그인 버튼 클릭
        await page.click('.MuiButton-contained.MuiButton-containedPrimary');

        // 로그인 후 페이지가 로드될 때까지 기다림
        await page.waitForNavigation();

        const cookies = await page.cookies();
        const sessionTokenCookie = cookies.find(cookie => cookie.name === '__Secure-next-auth.session-token');

        if (sessionTokenCookie) {
            // 엔드포인트 호출
            const endpointUrl = 'https://papa.hr.crew-admin.papa-service.com/api/employees/vacation-list?wfId=';
            await page.goto(endpointUrl);

            // 여기서 response를 처리하거나 결과를 콘솔에 출력할 수 있음
            const responseData = await page.evaluate(() => {
                return JSON.parse(document.body.textContent);
            });
            console.log(responseData);
            const firstItemId = responseData.data.list[0].id;

            console.log('첫 번째 아이템의 id:', firstItemId);

            // firstItemId를 기준으로 반복
            for (let i = 1; i <= firstItemId; i++) {
                const dynamicUrl = `https://papa.hr.crew-admin.papa-service.com/api/employees/vacation-list?wfId=${i}`;

                await page.goto(dynamicUrl);

                const responseData2 = await page.evaluate(() => {
                    return JSON.parse(document.body.textContent);
                });

                console.log(`동적으로 생성된 API 응답 ${i}/${firstItemId}:`, responseData2.data.list);

                // responseData2.data.list 배열이 비어있는지 확인
                if (responseData2.data.list.length > 0) {
                    // 첫 번째 아이템의 connect 항목 출력

                    let status = ""
                    if (responseData2.data.list[0].stepCode == "DRAFT"){
                        status = "기안"
                    } else if (responseData2.data.list[0].stepCode == "ING"){
                        status = "진행"
                    } else if (responseData2.data.list[0].stepCode == "COMPLETE"){
                        status = "완료"
                    } else if (responseData2.data.list[0].stepCode == "CANCEL"){
                        status = "취소"
                    } else if (responseData2.data.list[0].stepCode === "REJECT"){
                        status = "반려"
                    } else {
                        status = "확인필요"
                    }

                    let type = ""
                    if (responseData2.data.list[0].vacTypeCode == "VAC001"){
                        type = "유급연차"
                    } else if (responseData2.data.list[0].vacTypeCode == "VAC002"){
                        type = "무급연차"
                    } else if (responseData2.data.list[0].vacTypeCode == "VAC003"){
                        type = "경조사"
                    } else if (responseData2.data.list[0].vacTypeCode == "VAC005"){
                        type = "병가"
                    } else {
                        type = "확인필요"
                    }


                    let division = ""
                    if (responseData2.data.list[0].annualTypeCode == "ANN001"){
                        division = "종일"
                    } else {
                        division = "확인필요"
                    }

                    let startDate = responseData2.data.list[0].startDate.split('T')[0]
                    let endDate = responseData2.data.list[0].endDate.split('T')[0]

                    const vacation = {
                        crewid: responseData2.data.list[0].draftUserId,
                        crewname: responseData2.data.list[0].name,
                        applicationid: responseData2.data.list[0].id,
                        status: status,
                        type: type,
                        division: division,
                        startDate: startDate,
                        endDate: endDate,
                        appliedDate: responseData2.data.list[0].createdAt,
                        reason: responseData2.data.list[0].desc,
                    };

                    vacationData.push(vacation);

                    console.log('첫 번째 Connect 항목:', vacation);
                
                } else {
                    console.log('responseData2.data.list 배열이 비어있습니다.');
                }
            }

            console.log('첫 번째 아이템의 id:', responseData.data.list[0].id);

        } else {
            console.error('세션 토큰 쿠키를 찾을 수 없습니다.');
        }
        
        await browser.close();

        const responseApi = {
            message: 'Scraping successful',
            data: vacationData,
        };

        res.json(responseApi);

    } catch (error) {
        console.error('Error during scraping:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/*', (req, res) => {
    res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Date: Date.now(),
    });
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(port, () => {
    console.log(`app listening at http://localhost:${port}`);
});
