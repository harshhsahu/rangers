import axios from "@/utils/interceptor";

const URL = process.env.NEXT_PUBLIC_SERVER_URL;

export const getAllFolders = async () => {
  try {
    const response = await axios.get(`${URL}/api/folder`);
    return response?.data;
  } catch (error) {
    console.error("Error fetching folders:", error);
    throw error;
  }
};

export const createFolder = async ({ name, type, config = {} }) => {
  try {
    const response = await axios.post(`${URL}/api/folder`, { name, type, config });
    return response?.data;
  } catch (error) {
    console.error("Error creating folder:", error);
    throw error;
  }
};

export const updateFolder = async ({ folder_id, name, type, config }) => {
  try {
    const response = await axios.put(`${URL}/api/folder`, { folder_id, name, type, config });
    return response?.data;
  } catch (error) {
    console.error("Error updating folder:", error);
    throw error;
  }
};

export const deleteFolder = async (folderId) => {
  try {
    const response = await axios.delete(`${URL}/api/folder/${folderId}`);
    return response?.data;
  } catch (error) {
    console.error("Error deleting folder:", error);
    throw error;
  }
};
