import { API_ORIGIN } from '@/config/publicEnv';
import { StreamFinalData, SystemResponse } from '@/types/exchange';
import api from './api';


export const getExchanges = async (conversationId: string, page: number) => {
  const response = await api.post('/exch/v1/getexch', {
    data: { conversationId, page },
  });
  return response.data;
};

export const createExchange = async (
  user_query: string,
  convId?: string,
  convTitle?: string,
) => {
  const response = await api.post('/exch/v1/createexch', {
    user_query,
    convId,
    convTitle,
  });
  return response.data;
};

export const updateExchange = async (
  exchangeId: string,
  systemResponse: SystemResponse,
) => {
  const response = await api.put('/exch/v1/updateexch', {
    exchangeId,
    systemResponse,
  });
  return response.data;
};

export interface ResponseStream {
  close: () => void;
  done: Promise<void>;
}

const decodeChunk = (value: string): string => {
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === 'string' ? parsed : value;
  } catch {
    return value;
  }
};

export const streamResponse = (
  responseId: string,
  onMessage: (message: string) => void,
  onEnd: (result: StreamFinalData) => void | Promise<void>,
  onError: (error: Error) => void,
  retryCount = 3,
): ResponseStream => {
  let eventSource: EventSource | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  let retries = 0;
  let lastEventId = '0-0';
  let settled = false;
  let manuallyClosed = false;
  let resolveDone: () => void;
  let rejectDone: (error: Error) => void;

  const done = new Promise<void>((resolve, reject) => {
    resolveDone = resolve;
    rejectDone = reject;
  });

  const clearTimers = () => {
    if (retryTimer) clearTimeout(retryTimer);
    if (inactivityTimer) clearTimeout(inactivityTimer);
    retryTimer = null;
    inactivityTimer = null;
  };

  const closeSource = () => {
    eventSource?.close();
    eventSource = null;
  };

  const finish = () => {
    if (settled) return;
    settled = true;
    clearTimers();
    closeSource();
    resolveDone();
  };

  const fail = (error: Error) => {
    if (settled) return;
    settled = true;
    clearTimers();
    closeSource();
    onError(error);
    rejectDone(error);
  };

  const connect = () => {
    if (settled || manuallyClosed) return;
    closeSource();
    const streamUrl = new URL(
      `/api/exch/v1/stream-response/${encodeURIComponent(responseId)}`,
      API_ORIGIN,
    );
    streamUrl.searchParams.set('lastEventId', lastEventId);
    eventSource = new EventSource(
      streamUrl.toString(),
      { withCredentials: true },
    );

    const resetInactivityTimer = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        reconnect(new Error('Response stream timed out'));
      }, 45_000);
    };

    const reconnect = (error: Error) => {
      clearTimers();
      closeSource();
      if (settled || manuallyClosed) return;
      if (retries >= retryCount) {
        fail(error);
        return;
      }
      retries += 1;
      retryTimer = setTimeout(connect, Math.min(1_000 * 2 ** (retries - 1), 8_000));
    };

    const rememberEventId = (event: Event) => {
      const id = (event as MessageEvent<string>).lastEventId;
      if (id) lastEventId = id;
    };

    resetInactivityTimer();

    eventSource.addEventListener('answer_chunk', event => {
      resetInactivityTimer();
      rememberEventId(event);
      onMessage(decodeChunk((event as MessageEvent<string>).data));
    });

    eventSource.addEventListener('final', event => {
      resetInactivityTimer();
      rememberEventId(event);
      let result: StreamFinalData;
      try {
        result = JSON.parse((event as MessageEvent<string>).data) as StreamFinalData;
      } catch {
        fail(new Error('The server returned an invalid final stream event'));
        return;
      }
      Promise.resolve(onEnd(result)).then(finish).catch(error => {
        fail(error instanceof Error ? error : new Error('Failed to finalize response'));
      });
    });

    eventSource.addEventListener('heartbeat', resetInactivityTimer);
    eventSource.addEventListener('server_error', event => {
      rememberEventId(event);
      let message = 'The response service failed';
      try {
        const data = JSON.parse((event as MessageEvent<string>).data) as { error?: string };
        if (data.error) message = data.error;
      } catch {
        // Preserve the safe fallback for malformed server errors.
      }
      fail(new Error(message));
    });
    eventSource.addEventListener('close', finish);
    eventSource.onerror = () => reconnect(new Error('Response stream disconnected'));
  };

  const close = () => {
    if (settled) return;
    manuallyClosed = true;
    finish();
  };

  connect();
  return { close, done };
};
