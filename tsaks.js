import express from "express";
import jwt from "jsonwebtoken";
import Task from "../models/Task.js";
import User from "../models/User.js";

const router = express.Router();

// auth middleware
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

// Get all active tasks
router.get("/tasks", auth, async (req, res) => {
    const tasks = await Task.find({ active: true });
    res.json({ tasks });
});

// Complete a task
router.post("/task/:id/complete", auth, async (req, res) => {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    // Reward user
    const user = await User.findById(req.user.id);
    user.walletBalance += task.reward;
    await user.save();

    res.json({
        message: "Task completed, reward added!",
        wallet: user.walletBalance
    });
});

export default router;