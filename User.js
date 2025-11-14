import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,
    referralCode: String,
    referredBy: String,
    walletBalance: { type: Number, default: 0 },
    fundAccountId: String,
    vpa: String,
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("User", UserSchema);