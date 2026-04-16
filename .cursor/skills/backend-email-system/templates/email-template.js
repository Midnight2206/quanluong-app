function renderEmailLayout({ title, intro, content, actionLabel, actionUrl, outro }) {
  const actionBlock = actionLabel && actionUrl
    ? `<p><a href="${actionUrl}" target="_blank" rel="noreferrer">${actionLabel}</a></p>`
    : "";

  return `
    <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
      <h1>${title}</h1>
      <p>${intro}</p>
      <div>${content}</div>
      ${actionBlock}
      <p>${outro || "Cam on ban."}</p>
    </div>
  `;
}

export { renderEmailLayout };
