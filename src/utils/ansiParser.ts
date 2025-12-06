/**
 * ANSI 颜色代码解析器
 * 将 ANSI 转义序列转换为 React 组件可用的样式
 */

export interface AnsiSegment {
  text: string;
  style: {
    color?: string;
    backgroundColor?: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
  };
}

/**
 * 256 色模式颜色映射
 */
const color256Map: Record<number, string> = {
  // 标准 16 色
  0: '#000000',   1: '#800000',   2: '#008000',   3: '#808000',
  4: '#000080',   5: '#800080',   6: '#008080',   7: '#c0c0c0',
  8: '#808080',   9: '#ff0000',  10: '#00ff00',  11: '#ffff00',
  12: '#0000ff', 13: '#ff00ff',  14: '#00ffff',  15: '#ffffff',
};

/**
 * 生成 256 色模式的颜色
 */
function getColor256(index: number): string {
  if (index < 16) {
    return color256Map[index] || '#000000';
  }
  if (index < 232) {
    // 216 色立方体
    const r = Math.floor((index - 16) / 36);
    const g = Math.floor(((index - 16) % 36) / 6);
    const b = (index - 16) % 6;
    const rVal = r === 0 ? 0 : 55 + r * 40;
    const gVal = g === 0 ? 0 : 55 + g * 40;
    const bVal = b === 0 ? 0 : 55 + b * 40;
    return `rgb(${rVal}, ${gVal}, ${bVal})`;
  }
  // 24 级灰度
  const gray = 8 + (index - 232) * 10;
  return `rgb(${gray}, ${gray}, ${gray})`;
}

/**
 * 解析 ANSI 转义序列
 */
export function parseAnsi(text: string): AnsiSegment[] {
  const segments: AnsiSegment[] = [];
  const ansiRegex = /\x1b\[([0-9;]*)([a-zA-Z])/g;
  
  let lastIndex = 0;
  let currentStyle: AnsiSegment['style'] = {};
  let match: RegExpExecArray | null;

  while ((match = ansiRegex.exec(text)) !== null) {
    // 添加转义序列之前的文本
    if (match.index > lastIndex) {
      const textBefore = text.substring(lastIndex, match.index);
      if (textBefore) {
        segments.push({
          text: textBefore,
          style: { ...currentStyle },
        });
      }
    }

    const code = match[1];
    const command = match[2];
    lastIndex = match.index + match[0].length;

    if (command === 'm') {
      // SGR (Select Graphic Rendition) 命令
      if (!code) {
        // 重置
        currentStyle = {};
      } else {
        const codes = code.split(';').map(Number);
        let i = 0;
        
        while (i < codes.length) {
          const c = codes[i];
          
          if (c === 0) {
            // 重置所有
            currentStyle = {};
          } else if (c === 1) {
            // 粗体
            currentStyle.bold = true;
          } else if (c === 3) {
            // 斜体
            currentStyle.italic = true;
          } else if (c === 4) {
            // 下划线
            currentStyle.underline = true;
          } else if (c === 22) {
            // 取消粗体
            currentStyle.bold = false;
          } else if (c === 23) {
            // 取消斜体
            currentStyle.italic = false;
          } else if (c === 24) {
            // 取消下划线
            currentStyle.underline = false;
          } else if (c >= 30 && c <= 37) {
            // 标准前景色
            currentStyle.color = color256Map[c - 30] || '#000000';
          } else if (c === 38) {
            // 扩展前景色
            if (i + 1 < codes.length) {
              if (codes[i + 1] === 5) {
                // 256 色模式
                if (i + 2 < codes.length) {
                  currentStyle.color = getColor256(codes[i + 2]);
                  i += 2;
                }
              } else if (codes[i + 1] === 2) {
                // RGB 模式
                if (i + 4 < codes.length) {
                  currentStyle.color = `rgb(${codes[i + 2]}, ${codes[i + 3]}, ${codes[i + 4]})`;
                  i += 4;
                }
              }
            }
          } else if (c === 39) {
            // 默认前景色
            delete currentStyle.color;
          } else if (c >= 40 && c <= 47) {
            // 标准背景色
            currentStyle.backgroundColor = color256Map[c - 40] || '#000000';
          } else if (c === 48) {
            // 扩展背景色
            if (i + 1 < codes.length) {
              if (codes[i + 1] === 5) {
                // 256 色模式
                if (i + 2 < codes.length) {
                  currentStyle.backgroundColor = getColor256(codes[i + 2]);
                  i += 2;
                }
              } else if (codes[i + 1] === 2) {
                // RGB 模式
                if (i + 4 < codes.length) {
                  currentStyle.backgroundColor = `rgb(${codes[i + 2]}, ${codes[i + 3]}, ${codes[i + 4]})`;
                  i += 4;
                }
              }
            }
          } else if (c === 49) {
            // 默认背景色
            delete currentStyle.backgroundColor;
          } else if (c >= 90 && c <= 97) {
            // 亮色前景色
            currentStyle.color = color256Map[c - 90 + 8] || '#000000';
          } else if (c >= 100 && c <= 107) {
            // 亮色背景色
            currentStyle.backgroundColor = color256Map[c - 100 + 8] || '#000000';
          }
          
          i++;
        }
      }
    }
  }

  // 添加剩余的文本
  if (lastIndex < text.length) {
    const remainingText = text.substring(lastIndex);
    if (remainingText) {
      segments.push({
        text: remainingText,
        style: { ...currentStyle },
      });
    }
  }

  // 如果没有匹配到任何 ANSI 代码，返回原始文本
  if (segments.length === 0) {
    segments.push({
      text,
      style: {},
    });
  }

  return segments;
}

/**
 * 将样式对象转换为 CSS 样式字符串
 */
export function styleToCss(style: AnsiSegment['style']): React.CSSProperties {
  const css: React.CSSProperties = {};
  
  if (style.color) {
    css.color = style.color;
  }
  if (style.backgroundColor) {
    css.backgroundColor = style.backgroundColor;
  }
  if (style.bold) {
    css.fontWeight = 'bold';
  }
  if (style.italic) {
    css.fontStyle = 'italic';
  }
  if (style.underline) {
    css.textDecoration = 'underline';
  }
  
  return css;
}

