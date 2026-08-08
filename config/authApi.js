import axios from "@/utils/interceptor";
import { toast } from "react-toastify";

const URL = process.env.NEXT_PUBLIC_SERVER_URL;
const PROXY_URL = process.env.NEXT_PUBLIC_PROXY_URL;

// User Authentication APIs
export const userdetails = async ({ exclude_role_ids = process.env.NEXT_PUBLIC_PROXY_USER_ROLE_ID, role_ids } = {}) => {
  try {
    const details = await axios.get(`${PROXY_URL}/api/c/getDetails`, {
      params: { exclude_role_ids, role_ids },
    });
    return details;
  } catch (error) {
    console.error(error);
  }
};

export const logoutUserFromMsg91 = async (headers) => {
  const User = await axios.delete(`${PROXY_URL}/api/c/logout`, headers);
  return User;
};

export const logoutUser = async (token) => {
  try {
    const response = await axios.post(
      `${URL}/api/user/logout`,
      {},
      {
        headers: { Authorization: token },
      }
    );
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const loginUser = async (dataToSend) => {
  try {
    const response = await axios.post(`${URL}/api/user/localToken`, dataToSend);
    return response.data?.data;
  } catch (error) {
    console.error(error);
    return error;
  }
};

export const switchUser = async (dataToSend) => {
  try {
    const response = await axios.post(`${URL}/api/user/switchOrg`, dataToSend);
    return response.data?.data;
  } catch (error) {
    console.error(error);
    return error;
  }
};

// Auth Key Management APIs — /api/c/authkey network calls removed
export const allAuthKey = async () => ({ data: [] });

export const createAuthKey = async () => ({ data: null });

export const deleteAuthkey = async () => undefined;

export const getOrCreateNotificationAuthKey = async () => null;

// User Management APIs
export const updateUser = async ({ user_id, user }) => {
  const updateObject = { user_id, user: { meta: user?.meta } };
  try {
    const response = await axios.put(`${URL}/api/user/updateDetails`, updateObject);
    return response?.data;
  } catch (error) {
    console.error("Error updating details:", error.response?.data?.message || error.message);
    throw new Error(error.response?.data?.message || "Something went wrong");
  }
};

export const removeUsersFromOrg = async (user_id) => {
  try {
    const response = await axios.delete(`${URL}/api/user/deleteUser`, {
      data: { user_id },
    });
    return response.data;
  } catch (error) {
    toast.error(error.response.data.message);
    console.error(error);
    return error;
  }
};

// OAuth and Authentication APIs
export const getAuthData = async () => {
  try {
    const response = await axios.get(`${URL}/api/auth/`);
    return response;
  } catch (error) {
    console.error(error);
    return error;
  }
};

export const createNewAuth = async (data) => {
  try {
    const response = await axios.post(`${URL}/api/auth/`, data);
    return response;
  } catch (error) {
    console.error(error);
    return error;
  }
};

export const verifyAuth = async (data) => {
  try {
    const respnse = await axios.post(`${URL}/api/auth/verify`, data);
    return respnse;
  } catch (error) {
    console.error(error);
    return error;
  }
};

export const getClientInfo = async (client_id) => {
  try {
    const respnse = await axios.get(`${URL}/api/auth/client_info?client_id=${client_id}`);
    return respnse?.data;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

// Public Agent Authentication
export const publicAgentLoginApi = async (user_id) => {
  try {
    const repsonse = await axios.post(`${URL}/api/runagents/public/login`, { user_id });
    return repsonse;
  } catch (error) {
    console.error(error);
    throw new Error(error);
  }
};

export const privateAgentLoginApi = async (user_id) => {
  try {
    const response = await axios.post(`${URL}/api/runagents/login`, { user_id });
    return response;
  } catch (error) {
    console.error(error);
    throw new Error(error);
  }
};
