// server.js
require('dotenv').config();
const express = require('express');
const Razorpay = require('razorpay');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 5000;

// ----- CONFIG -----
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123"; // change in .env

// ----- MIDDLEWARE -----
app.use(cors());
app.use(express.json());

// ----- RAZORPAY CLIENT -----
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// ----- SIMPLE IN-MEMORY STORAGE (demo only) -----
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

// ----- ADMIN AUTH MIDDLEWARE -----
function isAdmin(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token || token !== ADMIN_PASSWORD) {
    return res.status(403).json({ success: false, message: "Not authorized" });
  }
  next();
}

// ----- USER ROUTES -----

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

    const rupees = coins / 100; // 100 coins = ₹1
    const amountPaise = Math.round(rupees * 100);

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
      key: process.env.RAZORPAY_KEY_ID
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

    p.balance -= coinsNum;
    const rupees = (coinsNum / 100).toFixed(2);

    const entry = {
      coins: coinsNum,
      amountInRupees: rupees,
      upiId,
      status: "Pending",
      txnId: "",
      note: "",
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

// Get withdraw history for one player
app.get('/api/withdraw-history', (req, res) => {
  const player = req.query.player;
  const p = getPlayer(player);
  res.json({
    success: true,
    history: p.withdrawHistory
  });
});

// ----- ADMIN ROUTES -----

// Get all withdrawals (all players)
app.get('/api/admin/withdrawals', isAdmin, (req, res) => {
  const all = [];

  for (const [playerName, data] of Object.entries(players)) {
    data.withdrawHistory.forEach((w, index) => {
      all.push({
        player: playerName,
        index,
        coins: w.coins,
        amountInRupees: w.amountInRupees,
        upiId: w.upiId,
        status: w.status,
        txnId: w.txnId || "",
        note: w.note || "",
        time: w.time
      });
    });
  }

  // latest first
  all.sort((a, b) => new Date(b.time) - new Date(a.time));

  res.json({ success: true, withdrawals: all });
});

// Update one withdrawal (approve/reject)
app.post('/api/admin/withdrawals/update', isAdmin, (req, res) => {
  try {
    const { player, index, status, txnId, note } = req.body;

    if (!player || typeof index !== "number") {
      return res.status(400).json({ success: false, message: "Player and index required" });
    }

    if (!["Pending", "Approved", "Rejected"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const p = getPlayer(player);
    if (!p.withdrawHistory[index]) {
      return res.status(404).json({ success: false, message: "Withdraw not found" });
    }

    p.withdrawHistory[index].status = status;
    p.withdrawHistory[index].txnId = txnId || p.withdrawHistory[index].txnId || "";
    p.withdrawHistory[index].note = note || p.withdrawHistory[index].note || "";

    res.json({ success: true, history: p.withdrawHistory });
  } catch (err) {
    console.error("admin update error:", err);
    res.status(500).json({ success: false, message: "Server error updating withdrawal" });
  }
});




// ===============================
// MANUAL ADD MONEY SYSTEM (UPI)
// ===============================
const manualPayments = [];

// USER: Submit manual payment details
app.post('/api/manual-add', (req, res) => {
  try {
    const { player, amount, txnId } = req.body;

    if (!player || !amount || !txnId) {
      return res.status(400).json({ success: false, message: "All fields required" });
    }

    manualPayments.push({
      player,
      amount: Number(amount),
      txnId,
      status: "Pending",
      time: new Date().toISOString()
    });

    res.json({ success: true, message: "Manual payment submitted" });
  } catch (err) {
    console.error("manual-add error:", err);
    res.status(500).json({ success: false });
  }
});

// ADMIN: Get all manual payments
app.get('/api/admin/manual-payments', isAdmin, (req, res) => {
  res.json({ success: true, data: manualPayments });
});

// ADMIN: Approve manual payment & ADD COINS
app.post('/api/admin/manual-approve', isAdmin, (req, res) => {
  try {
    const { index } = req.body;
    const item = manualPayments[index];

    if (!item || item.status !== "Pending") {
      return res.status(400).json({ success: false, message: "Invalid request" });
    }

    // ₹1 = 100 Coins
    const coins = Math.round(item.amount * 100);
    const p = getPlayer(item.player);

    p.balance += coins;
    item.status = "Approved";

    res.json({
      success: true,
      newBalance: p.balance
    });
  } catch (err) {
    console.error("manual-approve error:", err);
    res.status(500).json({ success: false });
  }
});




// ----- START SERVER -----
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
