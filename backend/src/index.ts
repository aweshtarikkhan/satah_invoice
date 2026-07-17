import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(helmet());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Satah Invoices Backend is running" });
});

app.get("/api/gst/:gstNumber", async (req, res) => {
  const { gstNumber } = req.params;
  try {
    const response = await fetch(`https://gst-insights-api.p.rapidapi.com/getGSTDetailsUsingGST/${gstNumber}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-rapidapi-host": "gst-insights-api.p.rapidapi.com",
        "x-rapidapi-key": process.env.RAPID_API_KEY || "fc51287228msha55f054f75ad5b4p140f17jsnfd81e870b87d"
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: "Failed to fetch from GST API" });
    }

    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
