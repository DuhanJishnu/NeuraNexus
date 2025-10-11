import { Request, Response } from "express";
import { prisma } from "../config/prisma";
import { Conversation } from "../types/conversation";
import { PYTHON_SERVER_URL, QUERY_REQUEST_TIMEOUT_MS } from "../config/envExports";
import { redis } from "../config/redis";
import { SystemResponseSchema } from "../schemas/exchange";

const prismaClient = prisma;

const pageSize: number = 15;

export const createExchange = async (req: Request, res: Response) => {
  const { user_query, convId } = req.body;

  console.log("createExchange ", req.body);
  if (!user_query || user_query.trim() === "") {
    return res
      .status(400)
      .json({ error: "user_query is required and cannot be empty." });
  }
  let { convTitle } = req.body; 
  let newConversation: Conversation | null = null;
  let conversationId = convId === "" ? null : convId;

  if(!convTitle){
    convTitle = "A new Title";
  }
  if (!conversationId) {
    newConversation = await prismaClient.conversation.create({
      data: { userId: req.user!.id, title: convTitle },
    });
    conversationId = newConversation.id;
  }

  await prismaClient.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  const responseId = Date.now().toString();

  const exchange = await prismaClient.exchange.create({
    data: {
      userQuery: user_query,
      conversationId,
      systemResponse: "",
    },
  });

  // 🔹 Kick off async Python request → don’t await, let it run in background
  (async () => {
    console.log("PYTHON SERVER: Starting async request to Python server...");
    let pyRes; 
    try {
      pyRes = await fetch(`${PYTHON_SERVER_URL}/api/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        question: user_query, 
        conv_id: conversationId,
        secure_mode: false
      }),
    });
    } catch (error) {
      console.log("PYTHON ERROR: ", error)
    }
    console.log("PYTHON SERVER: Response received from Python server", pyRes);
    if (!pyRes?.body || !pyRes) {
      console.error("PYTHON SERVER ERROR: No response body from Python server");
      return;
    };
    const reader = pyRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split("\n\n");
      buffer = parts.pop()!;
      for (const part of parts) {
        if (!part.trim()) continue;
        const match = part.match(/^data:\s*(.+)$/m);
        if (match) {
          const event = JSON.parse(match[1]);
          console.log("Event from Python:", event);
          await redis.xadd(
            `responseId:${responseId}`,
            "*",
            "conversation", conversationId,
            "responseId", responseId,
            "type", event.type,
            "data", JSON.stringify(event.data)
          );
        }
      }
    }
  })();

  return res.status(200).json({
    exchange,
    conversation: newConversation,
    responseId,
  });
};

export const updateExchange = async (req: Request, res: Response) => {  
  const { exchangeId, systemResponse } = req.body;

  const parsedSystemResponse = SystemResponseSchema.safeParse(systemResponse);
  if (!parsedSystemResponse.success) {
    return res.status(400).json({ error: "Invalid systemResponse format." });
  }

  console.log("updateExchange ", req.body);
  if (!exchangeId || exchangeId.trim() === "") {
    return res
      .status(400)
      .json({ error: "exchangeId is required and cannot be empty." });
  }

  const updatedExchange = await prismaClient.exchange.update({
    where: { id: exchangeId },
    data: { systemResponse: parsedSystemResponse.data },
  });

  return res.status(200).json({
    exchange: updatedExchange,
  });
};


export const streamResponse = async (req: Request, res: Response) => {
  const { responseId } = req.params;

  console.log("SSE: Client connected for responseId:", responseId);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let lastId = "0"; // start from beginning

  (async function readLoop() {
    let lastMessageTime = Date.now();
    try {
      while (true) {
        const messages = await redis.xread(
          "BLOCK",
          100, 
          "STREAMS",
          `responseId:${responseId}`,
          lastId
        );

        if (!messages) {
          // check if it's been specified time in secs
          if (Date.now() - lastMessageTime > QUERY_REQUEST_TIMEOUT_MS) {
            console.log(`No data for ${QUERY_REQUEST_TIMEOUT_MS / 1000}s, closing SSE connection`);
            res.write("event: close\n\n");
            res.write("data: timeout\n\n");
            res.end();
            return;
          }
          continue;
        }

        for (const [, entries] of messages) {
          for (const [id, fields] of entries) {
            lastId = id;
            lastMessageTime = Date.now();

            const msg: Record<string, string> = {};
            for (let i = 0; i < fields.length; i += 2) {
              msg[fields[i]] = fields[i + 1];
            }

            // forward to client
            console.log("SSE: Sending message to client:", msg);
            res.write(`event: ${msg.type}\n`);
            res.write(`data: ${msg.data}\n\n`);

            if (msg.type === "final") {
              res.write("event: close\n\n");
              res.end(); 
              return;
            }
          }
        }
      }
    } catch (err) {
      console.error("SSE stream error:", err);
      res.end();
    }
  })();
};


export const getExchanges = async (req: Request, res: Response) => {
  console.log("getExchanges ", req.body);
  const { conversationId, page } = req.body.data;
  console.log("conversationId, page : ", conversationId, page);
  const exchanges = await prismaClient.exchange.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  res.json({
    exchanges,
  });
};
