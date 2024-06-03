import { IBrother } from "../interfaces/api.interface";

const a = require("axios");

const axios = a.create({
  baseURL: "http://localhost:8080",
});

export async function getAllBrothers(): Promise<Array<IBrother>> {
  try {
    const response = await axios.get("/brothers");
    return response.data;
  } catch (error) {
    return [];
  }
}

export async function addBrother(brother: IBrother) {
  try {
    const response = await axios.post("/brothers", brother);
    return response.status;
  } catch (error) {
    return 400;
  }
}

export async function editBrother(brother: IBrother, id: number) {
  try {
    const response = await axios.put("/brothers/" + id, brother);
    return response.status;
  } catch (error) {
    return 400;
  }
}
