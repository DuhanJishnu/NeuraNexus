import  api  from "./api";

export const getRecentConversations = async (page: number) => {
  const res = await api.get("/conv/v1/getrecentconv", {
    // headers: { Authorization: accessToken },
   params: { page },
  });
  return res.data;
};

export const updateConvTitle = async (convId: string, title: string) => {
  const res = await api.post("/conv/v1/updatetitle", {
    convId,
    title,
  });
  return res.data;
};
