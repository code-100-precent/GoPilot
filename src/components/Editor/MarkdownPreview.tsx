import React, { useEffect, useRef } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { cn } from '@/utils/cn';

interface MarkdownPreviewProps {
  content: string;
  className?: string;
  filePath?: string; // 文件路径，用于解析相对路径图片
  workspaceRoot?: string; // 工作区根路径
}

const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ content, className, filePath, workspaceRoot }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !content) return;

    // 配置 marked 选项，支持 HTML
    marked.setOptions({
      breaks: true,
      gfm: true, // GitHub Flavored Markdown
      headerIds: true,
      mangle: false,
    });

    // 渲染 Markdown（支持 HTML）
    const html = marked.parse(content);
    
    // 清理 HTML（允许更多标签以支持 HTML/CSS）
    const cleanHtml = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u', 's', 'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'blockquote', 'hr', 'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'div', 'span', 'center', 'style'
      ],
      ALLOWED_ATTR: [
        'href', 'src', 'alt', 'title', 'class', 'id', 'width', 'height', 'align', 'target', 'rel', 'style'
      ],
      ALLOW_DATA_ATTR: false,
      // 允许 style 标签中的 CSS
      ALLOW_UNKNOWN_PROTOCOLS: true,
      KEEP_CONTENT: true,
    });

    if (containerRef.current) {
      containerRef.current.innerHTML = cleanHtml;
      
      // 处理相对路径图片
      if (filePath) {
        const images = containerRef.current.querySelectorAll('img');
        images.forEach((img) => {
          const src = img.getAttribute('src');
          if (src && !src.match(/^(https?:\/\/|\/|data:)/)) {
            // 相对路径，需要转换为绝对路径
            const fileDir = filePath.substring(0, filePath.lastIndexOf('/') || filePath.lastIndexOf('\\'));
            const absolutePath = fileDir ? `${fileDir}/${src}` : src;
            // 在浏览器中，相对路径应该相对于当前文件
            // 使用相对路径，浏览器会自动解析
            img.setAttribute('src', absolutePath);
          }
        });
      }
    }
  }, [content, filePath, workspaceRoot]);

  return (
    <div className={cn('h-full overflow-auto bg-white dark:bg-gray-900', className)}>
      <div
        ref={containerRef}
        className="markdown-body max-w-4xl mx-auto p-6 prose prose-sm dark:prose-invert prose-headings:font-semibold prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-img:rounded-lg prose-code:bg-gray-100 dark:prose-code:bg-gray-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-gray-100 dark:prose-pre:bg-gray-800 prose-pre:border prose-pre:border-gray-300 dark:prose-pre:border-gray-700 prose-table:border-collapse prose-table:border prose-table:border-gray-300 dark:prose-table:border-gray-700 prose-th:border prose-th:border-gray-300 dark:prose-th:border-gray-700 prose-th:bg-gray-100 dark:prose-th:bg-gray-800 prose-th:p-2 prose-td:border prose-td:border-gray-300 dark:prose-td:border-gray-700 prose-td:p-2"
        style={{
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
          lineHeight: '1.6',
          color: 'inherit',
        }}
      />
      <style>{`
        .markdown-body {
          box-sizing: border-box;
          min-width: 200px;
          max-width: 980px;
          margin: 0 auto;
          padding: 45px;
        }
        .markdown-body img {
          max-width: 100%;
          height: auto;
        }
        .markdown-body table {
          display: block;
          width: 100%;
          overflow: auto;
          border-spacing: 0;
          border-collapse: collapse;
        }
        .markdown-body table th,
        .markdown-body table td {
          padding: 6px 13px;
          border: 1px solid #d0d7de;
        }
        .markdown-body table tr {
          background-color: #ffffff;
          border-top: 1px solid #c6cbd1;
        }
        .markdown-body table tr:nth-child(2n) {
          background-color: #f6f8fa;
        }
        .dark .markdown-body table th,
        .dark .markdown-body table td {
          border-color: #30363d;
        }
        .dark .markdown-body table tr {
          background-color: #0d1117;
          border-top-color: #21262d;
        }
        .dark .markdown-body table tr:nth-child(2n) {
          background-color: #161b22;
        }
        .markdown-body code {
          padding: 0.2em 0.4em;
          margin: 0;
          font-size: 85%;
          background-color: rgba(175, 184, 193, 0.2);
          border-radius: 6px;
        }
        .dark .markdown-body code {
          background-color: rgba(110, 118, 129, 0.4);
        }
        .markdown-body pre {
          padding: 16px;
          overflow: auto;
          font-size: 85%;
          line-height: 1.45;
          background-color: #f6f8fa;
          border-radius: 6px;
        }
        .dark .markdown-body pre {
          background-color: #161b22;
        }
        .markdown-body pre code {
          display: inline;
          max-width: auto;
          padding: 0;
          margin: 0;
          overflow: visible;
          line-height: inherit;
          word-wrap: normal;
          background-color: transparent;
          border: 0;
        }
        .markdown-body h1, .markdown-body h2 {
          padding-bottom: 0.3em;
          border-bottom: 1px solid #d0d7de;
        }
        .dark .markdown-body h1, .dark .markdown-body h2 {
          border-bottom-color: #21262d;
        }
        .markdown-body blockquote {
          padding: 0 1em;
          color: #656d76;
          border-left: 0.25em solid #d0d7de;
        }
        .dark .markdown-body blockquote {
          color: #8b949e;
          border-left-color: #30363d;
        }
        .markdown-body [align="center"] {
          text-align: center;
        }
        .markdown-body [align="center"] > * {
          display: inline-block;
        }
        .markdown-body div[align="center"] {
          text-align: center;
        }
        .markdown-body div[align="center"] > * {
          display: inline-block;
          margin: 0 auto;
        }
        .markdown-body img[src*="badge"] {
          display: inline;
          margin: 0 2px;
        }
      `}</style>
    </div>
  );
};

export default MarkdownPreview;

