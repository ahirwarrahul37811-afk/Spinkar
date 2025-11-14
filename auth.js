import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = express.Router();

function generateReferralCode(name) {
    return (name.substring(0, 4) + Math.floor(1000 + Math.random() * 9000)).toUpperCase();
}

router.post("/signup", async (req, res) => {
    try {
        const { name, email, password, referredBy } = req.body;

        let exists = await User.findOne({ email });
        if (exists) return res.status(400).json({ message: "Email already exists" });

        const hashed = await bcrypt.hash(password, 10);
        const referralCode = generateReferralCode(name);

        const user = await User.create({
            name, email, password: hashed, referralCode, referredBy
        });

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
        res.json({ token, user });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post("/login", async (req, res) => {
    let user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(400).json({ message: "Invalid email" });

    const ok = await bcrypt.compare(req.body.password, user.password);
    if (!ok) return res.status(400).json({ message: "Wrong password" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);

    res.json({ token, user });
});

router.get("/me", async (req, res) => {
    try {
        const token = req.headers.authorization.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        let user = await User.findById(decoded.id).select("-password");
        res.json({ user });

    } catch {
        res.status(401).json({ message: "Unauthorized" });
    }
});

export default router;