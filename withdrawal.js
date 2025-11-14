import express from "express";
import jwt from "jsonwebtoken";
import Withdrawal from "../models/Withdrawal.js";
import User from "../models/User.js";

const router = express.Router();

function auth(req, res, next) {
    try {
        const token = req.headers.authorization.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch {
        return res.status(401).json({ message: "Unauthorized" });
    }
}

// User creates withdrawal request
router.post("/withdraw", auth, async (req, res) => {
    const { amount, method, details } = req.body;

    const user = await User.findById(req.user.id);

    if (user.walletBalance < amount)
        return res.status(400).json({ message: "Insufficient balance" });

    user.walletBalance -= amount;
    await user.save();

    const w = await Withdrawal.create({
        userId: user._id,
        amount,
        method,
        details
    });

    res.json({ message: "Withdrawal request submitted", w });
});

// Get user withdrawal requests
router.get("/withdraw/history", auth, async (req, res) => {
    const w = await Withdrawal.find({ userId: req.user.id });
    res.json({ withdrawals: w });
});

export default router;