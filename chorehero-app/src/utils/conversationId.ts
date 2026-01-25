export const getConversationId = (userId: string, proId: string): string => {
  const [first, second] = [userId, proId].sort();
  return `conv_${first}_${second}`;
};
