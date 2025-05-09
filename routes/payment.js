const express = require('express');
const router = express.Router();
const { generate } = require('vietqr');

const CLIENT_ID = "467bd357-394b-47e7-bd68-d3ccef0d2b6c";
const API_KEY = "cea86dcd-8cd7-44ca-83ed-649fc6f0fd5b";

router.post('/bankqr', async (req, res) => {
    try {
        const { amount, orderId, description } = req.body;
        if (!amount || !orderId) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        const qrData = {
            bankCode: "970422",
            accountNo: "0377830916",
            accountName: "PHUN KHOAN VO",
            amount: Math.round(Number(amount)),
            addInfo: description || `Thanh toan don hang #${orderId}`,
            template: "compact"
        };

        const result = await generate(qrData, {
            clientId: CLIENT_ID,
            apiKey: API_KEY
        });

        if (!result || !result.data || !result.data.qrDataURL) {
            return res.status(500).json({
                success: false,
                message: 'Failed to generate QR code'
            });
        }

        return res.status(200).json({
            success: true,
            qrImage: result.data.qrDataURL,
            addInfo: qrData.addInfo,
            message: 'QR code generated successfully'
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to generate QR code'
        });
    }
});

router.post('/update-status', async (req, res) => {
    try {
        const { orderId, status } = req.body;
        
        if (!orderId || !status) {
            return res.error('Missing required fields');
        }

        // TODO: Cập nhật trạng thái đơn hàng trong database
        
        return res.success({
            orderId,
            status
        }, 'Payment status updated successfully');

    } catch (error) {
        console.error('Payment Status Update Error:', error);
        return res.error('Failed to update payment status');
    }
});

module.exports = router;