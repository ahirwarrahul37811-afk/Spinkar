import mongoose from "mongoose";

const WithdrawalSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    amount: Number,
    method: String,
    details: Object,
    status: { type: String, default: "pending" },
    razorpayPayoutId: String,
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Withdrawal", WithdrawalSchema);