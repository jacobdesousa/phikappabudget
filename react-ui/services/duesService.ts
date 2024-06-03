import { IDues } from "../interfaces/api.interface";

const a = require("axios");

const axios = a.create({
  baseURL: "http://localhost:8080",
});

export async function getDues(): Promise<Array<IDues>> {
  try {
    const response = await axios.get("/dues");
    return response.data;
  } catch (error) {
    return [];
  }
}

export async function updateDues(duesRecord: IDues) {
  try {
    const response = await axios.put("/dues", duesRecord);
    return response.status;
  } catch (error) {
    return 400;
  }
}
