import mongoose from "mongoose";

const ReferralSchema = new mongoose.Schema({
    referredUser: String,
    referrerUser: String,
    reward: Number,
    date: { type: Date, default: Date.now }
});

export default mongoose.model("Referral", ReferralSchema);