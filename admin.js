import express from "express";
import User from "../models/User.js";
import Task from "../models/Task.js";
import Withdrawal from "../models/Withdrawal.js";
import { makePayout } from "../services/razorpay.js";

const router = express.Router();

// Admin auth
function admin(req, res, next) {
    const token = req.headers["x-admin-token"];
    if (token === process.env.ADMIN_TOKEN) return next();
    return res.status(401).json({ message: "Admin Unauthorized" });
}

// Get all users
router.get("/users", admin, async (req, res) => {
    res.json({ users: await User.find().select("-password") });
});

// Add Task
router.post("/task", admin, async (req, res) => {
    const t = await Task.create(req.body);
    res.json({ task: t });
});

// Get Withdrawals
router.get("/withdrawals", admin, async (req, res) => {
    const w = await Withdrawal.find().populate("userId");
    res.json({ withdrawals: w });
});

// Approve withdrawal → Razorpay Payout
router.post("/withdrawals/:id/approve", admin, async (req, res) => {
    const w = await Withdrawal.findById(req.params.id).populate("userId");

    if (!w) return res.status(404).json({ message: "Withdrawal not found" });
    if (w.status !== "pending")
        return res.status(400).json({ message: "Already processed" });

    // FUND ACCOUNT ID hona jaruri
    if (!w.userId.fundAccountId)
        return res.status(400).json({ message: "User fund account missing" });

    // Razorpay payout trigger
    const payout = await makePayout({
        amount: w.amount,
        fund_account_id: w.userId.fundAccountId
    });

    w.status = "paid";
    w.razorpayPayoutId = payout.id;
    await w.save();

    res.json({ message: "Payout sent!", payout });
});

// Reject withdrawal
router.post("/withdrawals/:id/reject", admin, async (req, res) => {
    const w = await Withdrawal.findById(req.params.id);
    w.status = "rejected";
    await w.save();
    res.json({ message: "Request rejected" });
});

export default router;