const express = require('express');
const router = express.Router();
const { VietQR } = require('vietqr');

const CLIENT_ID = "467bd357-394b-47e7-bd68-d3ccef0d2b6c";
const API_KEY = "cea86dcd-8cd7-44ca-83ed-649fc6f0fd5b";

const vietQRInstance = new VietQR({
    clientID: CLIENT_ID,
    apiKey: API_KEY
});

router.post('/bankqr', async (req, res) => {
    try {
        console.log('Received request for /bankqr:', req.body);

        const { amount, orderId, description } = req.body;
        if (!amount || !orderId) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu trường amount hoặc orderId'
            });
        }

        const qrDataPayloadForLibrary = {
            bank: "970422",
            accountNumber: "0377830916",
            accountName: "PHUN KHOAN VO",
            amount: Math.round(Number(amount)),
            memo: description || `Thanh toan don hang ${orderId}`,
            template: "compact2"
        };

        console.log('Payload to be processed by vietqr library:', qrDataPayloadForLibrary);

        const libraryResponse = await vietQRInstance.genQRCodeBase64(qrDataPayloadForLibrary);

        console.log('Data part of response from vietqr library:', libraryResponse ? JSON.stringify(libraryResponse.data, null, 2) : 'libraryResponse is undefined or null');

        if (
            !libraryResponse ||
            !libraryResponse.data ||
            libraryResponse.data.code !== '00' ||
            !libraryResponse.data.data ||
            !libraryResponse.data.data.qrDataURL
        ) {
            let errorMessage = 'Không thể tạo mã QR từ VietQR API.';
            if (libraryResponse && libraryResponse.data && libraryResponse.data.desc) {
                errorMessage = libraryResponse.data.desc;
            }
            console.error('Error generating QR - API Response Data:', libraryResponse && libraryResponse.data ? JSON.stringify(libraryResponse.data, null, 2) : 'No data in libraryResponse or libraryResponse itself is null/undefined');
            return res.status(500).json({
                success: false,
                message: errorMessage
            });
        }

        return res.status(200).json({
            success: true,
            qrImage: libraryResponse.data.data.qrDataURL,
            addInfo: qrDataPayloadForLibrary.memo,
            message: 'Tạo mã QR thành công'
        });

    } catch (error) {
        console.error('QR Generation Error (catch block):');
        if (error instanceof TypeError && error.message.includes('circular structure')) {
            console.error('Caught TypeError (circular structure):', error.message);
        } else if (error.response) {
            console.error('Axios error response status:', error.response.status);
            console.error('Axios error response data:', JSON.stringify(error.response.data, null, 2)); // data thường an toàn để stringify
        } else if (error.request) {
            console.error('Axios error request:', 'No response received for the request.');
        } else {
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
        }

        let message = 'Không thể tạo mã QR do lỗi không xác định.';
        if (error.response && error.response.data && error.response.data.message) {
            message = error.response.data.message;
        } else if (error.message && !(error instanceof TypeError && error.message.includes('circular structure'))) {
            message = error.message;
        }

        return res.status(500).json({
            success: false,
            message: message
        });
    }
});
router.post('/update-status', async (req, res) => {
    try {
        console.log('Received request for /update-status:', req.body);
        const { orderId, status } = req.body;

        if (!orderId || !status) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu trường orderId hoặc status'
            });
        }

        console.log(`Đã yêu cầu cập nhật trạng thái cho đơn hàng ${orderId} thành ${status}`);

        return res.status(200).json({
            success: true,
            data: {
                orderId,
                status,
            },
            message: 'Cập nhật trạng thái thanh toán thành công'
        });

    } catch (error) {
        console.error('Payment Status Update Error:', error.message);
        return res.status(500).json({
            success: false,
            message: error.message || 'Không thể cập nhật trạng thái thanh toán'
        });
    }
});

module.exports = router;