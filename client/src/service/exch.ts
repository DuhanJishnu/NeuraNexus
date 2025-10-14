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

export const streamResponse = async (
  responseId: string, 
  onMessage: (message: string) => void, 
  onEnd: (retrievals: JsonWebKey) => void, 
  onError: (error: any) => void,
  retryCount: number = 3
) => {
  let currentRetry = 0;
  
  const attemptConnection = (): Promise<() => void> => {
    return new Promise((resolve, reject) => {
      console.log(`Attempting stream connection, retry ${currentRetry}/${retryCount}`);
      
      const eventSource = new EventSource(`${process.env.NEXT_PUBLIC_BASEURL}/api/exch/v1/stream-response/${responseId}`, {
        withCredentials: true,
      });

      // Set a timeout to prevent hanging connections
      const timeoutId = setTimeout(() => {
        console.error("EventSource timeout after 30 seconds");
        eventSource.close();
        handleRetry(new Error("Connection timeout"));
      }, 30000);

      const handleRetry = (error: any) => {
        clearTimeout(timeoutId);
        eventSource.close();
        
        if (currentRetry < retryCount) {
          currentRetry++;
          console.log(`Retrying stream connection in 2 seconds... (${currentRetry}/${retryCount})`);
          
          setTimeout(() => {
            attemptConnection().then(resolve).catch(reject);
          }, 2000);
        } else {
          console.error("Max retries reached for stream connection");
          reject(error);
        }
      };

      eventSource.addEventListener("answer_chunk", (event) => {
        clearTimeout(timeoutId);
        let chunk = (event as MessageEvent).data;
        chunk = chunk.slice(1, -1);
        onMessage(chunk);
      });

      eventSource.addEventListener("final", (event) => {
        clearTimeout(timeoutId);
        const finalData = JSON.parse((event as MessageEvent).data);
        if (finalData.retrieved_documents && finalData.retrieved_documents.length > 0) {
          onEnd(finalData);
        } else {
          console.log("Final answer:", finalData.answer);
          if (finalData.answer) {
            onMessage(finalData.answer);
          }
        }
        eventSource.close();
        resolve(() => {
          clearTimeout(timeoutId);
          eventSource.close();
        });
      });

      // heartbeat
      eventSource.addEventListener("heartbeat", (event) => {
        console.log("Heartbeat:", (event as MessageEvent).data);
      });

      // Handle error events from server
      eventSource.addEventListener("error_event", (event) => {
        clearTimeout(timeoutId);
        console.error("Server error event:", (event as MessageEvent).data);
        handleRetry(new Error((event as MessageEvent).data));
      });

      eventSource.addEventListener("close", (event) => {
        clearTimeout(timeoutId);
        console.log("Server closed connection:", (event as MessageEvent).data);
        eventSource.close();
        resolve(() => {
          clearTimeout(timeoutId);
          eventSource.close();
        });
      });

      eventSource.onerror = (error) => {
        console.error("EventSource error:", error);
        
        // Check if it's a connection error vs other types
        if (eventSource.readyState === EventSource.CLOSED) {
          handleRetry(error);
        } else {
          clearTimeout(timeoutId);
          eventSource.close();
          reject(error);
        }
      };

      // Handle successful connection
      eventSource.addEventListener("open", () => {
        console.log("EventSource connection opened successfully");
        currentRetry = 0; // Reset retry count on successful connection
      });
    });
  };

  try {
    const closeFunction = await attemptConnection();
    return closeFunction;
  } catch (error) {
    console.error("Failed to establish stream connection after retries:", error);
    onError(error);
    return () => {}; // Return empty close function
  }
};
