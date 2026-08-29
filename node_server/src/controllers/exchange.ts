import { Request, Response } from "express";
import { prisma } from "../config/prisma";
import { Conversation } from "../types/conversation";
import { INGESTION_SERVICE_TOKEN, PYTHON_SERVER_URL, QUERY_REQUEST_TIMEOUT_MS } from "../config/envExports";
import { redis } from "../config/redis";
import { SystemResponseSchema } from "../schemas/exchange";
import { randomUUID } from "crypto";
import { IndexDeploymentService } from "../services/indexDeployment";

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
  const userId = req.user!.id;

  if(!convTitle){
    convTitle = "A new Title";
  }
  if (!conversationId) {
    newConversation = await prismaClient.conversation.create({
      data: { userId: req.user!.id, title: convTitle },
    });
    conversationId = newConversation.id;
  } else {
    const ownedConversation = await prismaClient.conversation.findFirst({
      where: { id: conversationId, userId },
      select: { id: true },
    });
    if (!ownedConversation) {
      return res.status(404).json({ error: "Conversation not found." });
    }
  }

  await prismaClient.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  const responseId = randomUUID();
  const activeIndexVersion = await IndexDeploymentService.getActiveVersion();
  await redis.set(
    `responseOwner:${responseId}`,
    userId,
    "EX",
    Math.ceil(QUERY_REQUEST_TIMEOUT_MS / 1000) + 300,
  );

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
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${INGESTION_SERVICE_TOKEN}`,
        "X-Request-Id": req.get("x-request-id") || responseId,
      },
      body: JSON.stringify({ 
        question: user_query, 
        conv_id: conversationId,
        secure_mode: false,
        retrieval_scope: {
          principal_id: userId,
          include_global: true,
        },
        index_version: activeIndexVersion,
      }),
    });
    } catch (error) {
      console.error("PYTHON ERROR: ", error);
      // Send error event to client
      await redis.xadd(
        `responseId:${responseId}`,
        "*",
        "conversation", conversationId,
        "responseId", responseId,
        "type", "error",
        "data", JSON.stringify({ error: "Failed to connect to Python server", success: false })
      );
      return;
    }
    console.log("PYTHON SERVER: Response received from Python server", pyRes);
    if (!pyRes?.body || !pyRes) {
      console.error("PYTHON SERVER ERROR: No response body from Python server");
      // Send error event to client
      await redis.xadd(
        `responseId:${responseId}`,
        "*",
        "conversation", conversationId,
        "responseId", responseId,
        "type", "error",
        "data", JSON.stringify({ error: "No response from Python server", success: false })
      );
      return;
    };
    const reader = pyRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split("\n\n");
        buffer = parts.pop()!;
        for (const part of parts) {
          if (!part.trim()) continue;
          try {
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
          } catch (parseError) {
            console.error("Error parsing event:", parseError, "Raw part:", part);
          }
        }
      }
    } catch (streamError) {
      console.error("Error reading stream:", streamError);
      // Send error event to client
      await redis.xadd(
        `responseId:${responseId}`,
        "*",
        "conversation", conversationId,
        "responseId", responseId,
        "type", "error",
        "data", JSON.stringify({ error: "Stream processing failed", success: false })
      );
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

  const ownedExchange = await prismaClient.exchange.findFirst({
    where: { id: exchangeId, conversation: { userId: req.user!.id } },
    select: { id: true },
  });
  if (!ownedExchange) {
    return res.status(404).json({ error: "Exchange not found." });
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
  const responseOwner = await redis.get(`responseOwner:${responseId}`);
  if (!responseOwner || responseOwner !== req.user!.id) {
    return res.status(404).json({ error: "Response stream not found." });
  }

  console.log("SSE: Client connected for responseId:", responseId);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const requestedLastId = String(req.query.lastEventId || "0-0");
  let lastId = /^\d+-\d+$/.test(requestedLastId) ? requestedLastId : "0-0";

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
            await redis.del(`responseOwner:${responseId}`);
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
            const eventType = msg.type === "error" ? "server_error" : msg.type;
            res.write(`id: ${id}\n`);
            res.write(`event: ${eventType}\n`);
            res.write(`data: ${msg.data}\n\n`);

            if (msg.type === "final" || msg.type === "error") {
              res.write("event: close\n\n");
              res.end(); 
              await redis.del(`responseOwner:${responseId}`);
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
    where: { conversationId, conversation: { userId: req.user!.id } },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  res.json({
    exchanges,
  });
};
