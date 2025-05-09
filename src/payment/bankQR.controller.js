const { VietQR } = require('vietqr');
const axios = require('axios');
const vietQR = new VietQR({
  clientID: '467bd357-394b-47e7-bd68-d3ccef0d2b6c',
  apiKey: 'cea86dcd-8cd7-44ca-83ed-649fc6f0fd5b',
});

exports.generateBankQR = async (req, res) => {
  let { amount, orderId } = req.body;
  console.log('Received request:', { amount, orderId });

  try {
    if (!amount || !orderId) {
      throw new Error('Thiếu thông tin thanh toán');
    }

    let amountVND = parseFloat(amount);
    if (amountVND < 1000) {
      amountVND = Math.round(amountVND * 25000);
    }

    const accountNo = '0377830916';
    const accountName = 'PHUN KHOAN VO';
    const bankId = '970422';
    const addInfo = `BOOKSTORE_${orderId}`;

    console.log('Generating QR with:', { bankId, accountNo, amountVND, addInfo }); // Debug log

    const qrData = await vietQR.genQRCodeBase64({
      bank: bankId,
      accountName: accountName,
      accountNumber: accountNo,
      amount: amountVND.toString(),
      memo: addInfo,
      template: 'compact2'
    });

    console.log('QR response:', qrData);

    if (qrData.code !== '00') {
      throw new Error(qrData.desc || 'Lỗi tạo mã QR');
    }

    res.json({
      success: true,
      qrImage: qrData.data.qrDataURL,
      addInfo,
      accountInfo: {
        accountNo,
        accountName,
        bankName: 'MB Bank',
        amountUSD: amount,
        amountVND: amountVND.toLocaleString('vi-VN')
      }
    });

  } catch (error) {
    console.error('Payment Error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi tạo mã QR',
      error: error.message
    });
  }
};

exports.updatePaymentStatus = async (req, res) => {
  const { orderId, status } = req.body;

  try {
   

    res.json({
      success: true,
      message: 'Cập nhật trạng thái thanh toán thành công'
    });
  } catch (error) {
    console.error('Update Payment Status Error:', error);
    res.status(500).json({
      message: 'Lỗi cập nhật trạng thái thanh toán',
      error: error.message
    });
  }
};

exports.getBanks = async (req, res) => {
  try {
    const banks = await vietQR.getBanks();
    console.log('Banks response:', banks); 
    res.json(banks);
  } catch (error) {
    console.error('Get Banks Error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi lấy danh sách ngân hàng',
      error: error.message
    });
  }
};