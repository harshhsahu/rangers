import { toast } from "react-toastify";
import axios from "@/utils/interceptor";

const URL = process.env.NEXT_PUBLIC_SERVER_URL;

// Chatbot Management APIs — network calls removed
export const getAllChatBot = async () => ({ data: { chatbots: [], chatbot_token: null } });

export const createChatBot = async () => ({ data: null });

export const getChatBotDetails = async () => ({ data: { chatbot: null } });

export const updateChatBot = async () => ({ data: null });

export const updateChatBotConfig = async () => ({ data: { config: {} } });

export const addorRemoveBridgeInChatBot = async () => ({ data: { chatBot: { chatBot: null } } });

// Chatbot Response Management APIs — network calls removed
export const getAllResponseTypesApi = async () => ({ data: [] });

export const createReponseTypeInOrg = async () => null;

export const createOrgToken = async () => {
  try {
    const data = await axios.post(`${URL}/api/utils/token`, {
      type: "org",
    });
    return data;
  } catch (error) {
    toast.error(error.response.data.error);
  }
};

export const addorRemoveResponseIdInBridge = async () => ({ data: null });

// Chatbot Action Management APIs — network calls removed
export const createOrRemoveAction = async () => null;
