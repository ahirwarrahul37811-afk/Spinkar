// server.js
require('dotenv').config();
const express = require('express');
const Razorpay = require('razorpay');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 5000;

// ----- MIDDLEWARE -----
app.use(cors());
app.use(express.json());

// ----- RAZORPAY CLIENT -----
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,       // TEST KEY ID
  key_secret: process.env.RAZORPAY_KEY_SECRET // TEST SECRET
});

// ----- SIMPLE IN-MEMORY STORAGE (demo only) -----
/*
  In real app:
   - Use proper DB (MySQL / MongoDB)
   - Save users, wallet, withdrawals permanently
*/
const players = {}; // { [playerName]: { balance: number, withdrawHistory: [] } }

function getPlayer(player) {
  if (!player) player = "Guest";
  if (!players[player]) {
    players[player] = {
      balance: 1000, // starting coins
      withdrawHistory: []
    };
  }
  return players[player];
}

// ----- ROUTES -----

// Get wallet balance
app.get('/api/wallet', (req, res) => {
  const player = req.query.player;
  const p = getPlayer(player);
  res.json({ success: true, balance: p.balance });
});

// Set wallet balance (demo - insecure for real money)
app.post('/api/wallet/set-balance', (req, res) => {
  const { player, balance } = req.body;
  if (typeof balance !== "number" || balance < 0) {
    return res.status(400).json({ success: false, message: "Invalid balance" });
  }
  const p = getPlayer(player);
  p.balance = Math.round(balance);
  res.json({ success: true, balance: p.balance });
});

// Create Razorpay order for coin purchase
app.post('/api/create-order', async (req, res) => {
  try {
    const { player, coins } = req.body;
    if (!coins || coins <= 0) {
      return res.status(400).json({ success: false, message: "Invalid coins amount" });
    }

    // Conversion: 100 coins = ₹1, so 1 coin = ₹0.01
    const rupees = coins / 100;
    const amountPaise = Math.round(rupees * 100); // Razorpay amount in paise

    const options = {
      amount: amountPaise,
      currency: 'INR',
      receipt: 'order_rcptid_' + Date.now(),
      notes: {
        player: player || "Guest",
        coins: String(coins)
      }
    };

    const order = await razorpay.orders.create(options);

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID, // test key for frontend
    });

  } catch (err) {
    console.error("create-order error:", err);
    res.status(500).json({ success: false, message: "Server error creating order" });
  }
});

// Verify payment and add coins
app.post('/api/payment/verify', (req, res) => {
  try {
    const { player, coins, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: "Missing payment details" });
    }

    const signString = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(signString)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Invalid payment signature" });
    }

    const p = getPlayer(player);
    const coinsNum = parseInt(coins, 10) || 0;
    p.balance += coinsNum;

    res.json({
      success: true,
      newBalance: p.balance
    });
  } catch (err) {
    console.error("payment/verify error:", err);
    res.status(500).json({ success: false, message: "Error verifying payment" });
  }
});

// Withdraw request
app.post('/api/withdraw-request', (req, res) => {
  try {
    const { player, upiId, coins } = req.body;
    const p = getPlayer(player);
    const coinsNum = parseInt(coins, 10);

    if (!upiId || !upiId.includes('@')) {
      return res.status(400).json({ success: false, message: "Invalid UPI ID" });
    }

    if (!coinsNum || coinsNum < 1000) {
      return res.status(400).json({ success: false, message: "Minimum withdrawal 1000 coins" });
    }

    if (coinsNum > p.balance) {
      return res.status(400).json({ success: false, message: "Insufficient balance" });
    }

    // Deduct coins immediately (or you can deduct after manual approval)
    p.balance -= coinsNum;
    const rupees = (coinsNum / 100).toFixed(2);

    const entry = {
      coins: coinsNum,
      amountInRupees: rupees,
      upiId,
      status: "Pending",
      time: new Date().toISOString()
    };

    p.withdrawHistory.push(entry);

    res.json({
      success: true,
      newBalance: p.balance,
      history: p.withdrawHistory
    });

  } catch (err) {
    console.error("withdraw-request error:", err);
    res.status(500).json({ success: false, message: "Server error in withdraw" });
  }
});

// Get withdraw history
app.get('/api/withdraw-history', (req, res) => {
  const player = req.query.player;
  const p = getPlayer(player);
  res.json({
    success: true,
    history: p.withdrawHistory
  });
});

// ----- START SERVER -----
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});