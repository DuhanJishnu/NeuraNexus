import { Response } from "@/types/exchange";
import api  from "./api";

// Get Exchanges
export const getExchanges = async (
  //accessToken: string,
  conversationId: string,
  page: number
) => {
  const res = await api.post("/exch/v1/getexch", {
    //headers: { Authorization: accessToken },
    data: { conversationId, page },
  });
  console.log("res data : ", res.data);
  return res.data;
};

// Create Exchange
export const createExchange = async (
  user_query: string,
  convId?: string,
  convTitle?: string,
  image?: File
) => {
  
  const res = await api.post("/exch/v1/createexch", {
    user_query,
    convId,
    convTitle,
  });
  return res.data;
};

export const updateExchange = async (
  exchangeId: string,
  systemResponse: Response,
  files?: Array<string>
) => {
  const res = await api.put("/exch/v1/updateexch", {
    exchangeId,
    systemResponse,
    files,
  });
  return res.data;
};

export const streamResponse = async (responseId: string, onMessage: (message: string) => void, onEnd: (retrievals: JsonWebKey) => void, onError: (error: any) => void) => {
  const eventSource = new EventSource(`${process.env.NEXT_PUBLIC_BASEURL}/api/exch/v1/stream-response/${responseId}`, {
    withCredentials: true,
  });

  eventSource.addEventListener("answer_chunk", (event) => {
    let chunk = (event as MessageEvent).data;
    chunk = chunk.slice(1, -1);
    onMessage(chunk);
  });

  eventSource.addEventListener("final", (event) => {
    if (JSON.parse((event as MessageEvent).data).retrieved_documents.length > 0) {
      onEnd(JSON.parse((event as MessageEvent).data));
    } else {
      console.log(JSON.parse((event as MessageEvent).data).answer);
      onMessage(JSON.parse((event as MessageEvent).data).answer);
    }
    eventSource.close(); 
  });

  // heartbeat
  eventSource.addEventListener("heartbeat", (event) => {
    console.log("Heartbeat:", (event as MessageEvent).data);
  });

  eventSource.onerror = (error) => {
    console.error("EventSource error:", error);
    onError(error);
    eventSource.close();
  };

  return () => {
    eventSource.close();
  };
};
