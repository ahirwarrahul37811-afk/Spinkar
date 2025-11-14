import Razorpay from "razorpay";

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Create payout
export async function makePayout({ amount, fund_account_id }) {
    const payout = await razorpay.payouts.create({
        account_number: "YOUR_RAZORPAYX_ACCOUNT",
        fund_account_id,
        amount: amount * 100,
        currency: "INR",
        mode: "IMPS",
        purpose: "payout"
    });

    return payout;
}