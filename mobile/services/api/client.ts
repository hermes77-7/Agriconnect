import axios from "axios";

export const api = axios.create({
  baseURL: "http://192.168.1.100:8080/api",
  timeout: 10000,
});
