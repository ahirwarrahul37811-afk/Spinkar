import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";

import authRoute from "./routes/auth.js";
import taskRoute from "./routes/tasks.js";
import withdrawRoute from "./routes/withdraw.js";
import adminRoute from "./routes/admin.js";

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

// Database connect
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB connected"))
.catch(err => console.log(err));

// Routes
app.use("/api", authRoute);
app.use("/api", taskRoute);
app.use("/api", withdrawRoute);
app.use("/admin", adminRoute);

app.get("/", (req, res) => {
    res.send("Promotion AI Backend Running...");
});

app.listen(5000, () => console.log("Server running on port 5000"));