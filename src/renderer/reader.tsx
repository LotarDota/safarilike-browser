import { Readability } from '@mozilla/readability';

/**
 * Reader mode: loads the target page's HTML, runs Mozilla Readability on it,
 * and injects the stripped-down article into this page. Keeps the same domain
 * for relative links so the user can continue reading series.
 */
async function renderReader(): Promise<void> {
  const src = new URL(location.href).searchParams.get('src');
  const target = document.getElementById('reader-content');
  if (!src || !target) return;

  try {
    const html = window.safarilike?.reader
      ? await window.safarilike.reader.fetch(src)
      : await (await fetch(src, { credentials: 'omit' })).text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    // Normalize relative URLs so images/links resolve when embedded here.
    const base = doc.createElement('base');
    base.href = src;
    doc.head.prepend(base);

    const article = new Readability(doc).parse();
    if (!article) throw new Error('Could not parse article');

    const h1 = document.createElement('h1');
    h1.textContent = article.title;
    target.appendChild(h1);

    if (article.byline) {
      const by = document.createElement('div');
      by.className = 'byline';
      by.textContent = article.byline;
      target.appendChild(by);
    }

    const body = document.createElement('div');
    body.innerHTML = article.content ?? '';
    target.appendChild(body);
  } catch (err) {
    target.innerHTML = `<h1>Reader unavailable</h1><p>${(err as Error).message}</p><p><a href="${src}">Open original</a></p>`;
  }
}

void renderReader();
