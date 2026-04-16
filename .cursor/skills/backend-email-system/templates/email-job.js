async function enqueueEmail(queue, { to, templateKey, templateData }) {
  return queue.add("send-email", {
    to,
    templateKey,
    templateData,
  });
}

export { enqueueEmail };
