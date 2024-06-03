import { IRevenue, IRevenueCategory } from "../interfaces/api.interface";

const a = require("axios");

const axios = a.create({
  baseURL: "http://localhost:8080",
});

export async function addRevenueCategory(revenueCategory: IRevenueCategory) {
  try {
    const response = await axios.post("/revenue/category", revenueCategory);
    return response.status;
  } catch (error) {
    return 400;
  }
}

export async function getRevenueCategories(): Promise<Array<IRevenueCategory>> {
  try {
    const response = await axios.get("/revenue/category");
    return response.data;
  } catch (error) {
    return [];
  }
}
