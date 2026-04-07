import {
  Children,
  cloneElement,
  isValidElement,
  useMemo,
} from 'react'
import { Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import rehypeRaw from 'rehype-raw'
import rehypeSlug from 'rehype-slug'
import { resolveAssetUrl } from '../utils/resolveAssetUrl.js'

const linkClass =
  'font-medium text-accent underline decoration-accent/30 underline-offset-2 transition hover:decoration-accent dark:text-accent-mint dark:decoration-accent-mint/40 dark:hover:decoration-accent-mint'

function isCheckboxInput(node) {
  return (
    isValidElement(node) &&
    node.type === 'input' &&
    node.props?.type === 'checkbox'
  )
}

/** Loose GFM task items put the checkbox inside the first `<p>`; tight items flatten it onto `<li>`. */
function extractTaskCheckbox(children) {
  const parts = Children.toArray(children).filter(
    (c) => !(typeof c === 'string' && c.trim() === ''),
  )

  const topInputIdx = parts.findIndex((c) => isCheckboxInput(c))
  if (topInputIdx >= 0) {
    return {
      input: parts[topInputIdx],
      rest: parts.filter((_, i) => i !== topInputIdx),
    }
  }

  const first = parts[0]
  if (isValidElement(first) && first.type === 'p') {
    const inner = Children.toArray(first.props.children)
    const inIdx = inner.findIndex((c) => isCheckboxInput(c))
    if (inIdx >= 0) {
      const inputEl = inner[inIdx]
      let after = inner.filter((_, i) => i !== inIdx)
      while (
        after.length > 0 &&
        typeof after[0] === 'string' &&
        /^\s*$/.test(after[0])
      ) {
        after = after.slice(1)
      }
      const rest = []
      if (after.length > 0) {
        rest.push(cloneElement(first, {}, after))
      }
      rest.push(...parts.slice(1))
      return { input: inputEl, rest }
    }
  }

  return { input: null, rest: parts }
}

function createMarkdownComponents({ checklistStyle = false } = {}) {
  return {
    h1({ children, id }) {
      return (
        <h1
          id={id}
          className="scroll-mt-28 border-b border-slate-200 pb-3 text-2xl font-bold tracking-tight text-ink dark:border-slate-600 dark:text-slate-50"
        >
          {children}
        </h1>
      )
    },
    h2({ children, id }) {
      return (
        <h2
          id={id}
          className="scroll-mt-28 mt-14 border-b border-slate-200 pb-2 text-xl font-bold tracking-tight text-ink first:mt-0 dark:border-slate-600 dark:text-slate-50"
        >
          {children}
        </h2>
      )
    },
    h3({ children, id }) {
      return (
        <h3
          id={id}
          className="scroll-mt-28 mt-10 text-lg font-semibold tracking-tight text-ink first:mt-0 dark:text-slate-100"
        >
          {children}
        </h3>
      )
    },
    h4({ children, id }) {
      return (
        <h4
          id={id}
          className="scroll-mt-28 mt-8 text-base font-semibold text-ink dark:text-slate-100"
        >
          {children}
        </h4>
      )
    },
    h5({ children, id }) {
      return (
        <h5
          id={id}
          className="scroll-mt-28 mt-6 text-sm font-semibold uppercase tracking-wide text-ink-soft dark:text-slate-400"
        >
          {children}
        </h5>
      )
    },
    h6({ children, id }) {
      return (
        <h6
          id={id}
          className="scroll-mt-28 mt-6 text-sm font-semibold text-ink-soft dark:text-slate-400"
        >
          {children}
        </h6>
      )
    },
    p({ node, children }) {
      const onlyImg =
        node?.children?.length === 1 &&
        node.children[0].type === 'element' &&
        node.children[0].tagName === 'img'
      if (onlyImg) {
        return <div className="my-8">{children}</div>
      }
      return (
        <p className="my-5 text-[15px] leading-7 text-slate-700 dark:text-slate-300">
          {children}
        </p>
      )
    },
    ul({ children, className }) {
      const taskList = /contains-task-list|task-list/.test(className ?? '')
      if (checklistStyle && taskList) {
        return (
          <ul
            className={`my-4 list-none space-y-2.5 pl-0 text-[15px] leading-7 text-slate-700 dark:text-slate-300 ${className ?? ''}`}
          >
            {children}
          </ul>
        )
      }
      return (
        <ul
          className={
            taskList
              ? `my-5 list-none space-y-2 pl-0 text-[15px] leading-7 text-slate-700 dark:text-slate-300 ${className ?? ''}`
              : `my-5 list-disc space-y-2 pl-6 text-[15px] leading-7 text-slate-700 marker:text-slate-400 dark:text-slate-300 dark:marker:text-slate-500 ${className ?? ''}`
          }
        >
          {children}
        </ul>
      )
    },
    ol({ children, className }) {
      return (
        <ol
          className={`my-5 list-decimal space-y-2 pl-6 text-[15px] leading-7 text-slate-700 marker:font-medium dark:text-slate-300 ${className ?? ''}`}
        >
          {children}
        </ol>
      )
    },
    li({ children, className }) {
      const taskItem = /task-list-item/.test(className ?? '')
      if (taskItem && checklistStyle) {
        const { input: inputChild, rest } = extractTaskCheckbox(children)
        return (
          <li
            className={`task-list-item list-none rounded-xl border border-teal-200/70 bg-white/90 px-4 py-3.5 shadow-sm dark:border-teal-500/30 dark:bg-slate-800/70 dark:shadow-none ${className ?? ''} has-[input:checked]:border-slate-300/60 has-[input:checked]:bg-slate-100/90 dark:has-[input:checked]:border-slate-600 dark:has-[input:checked]:bg-slate-900/60 has-[input:checked]:[&_.checklist-body]:text-slate-500 has-[input:checked]:[&_.checklist-body]:line-through dark:has-[input:checked]:[&_.checklist-body]:text-slate-400`}
          >
            <div className="flex items-center gap-5">
              {inputChild ? (
                <div className="checklist-checkbox flex w-10 shrink-0 items-center justify-center self-stretch">
                  {inputChild}
                </div>
              ) : null}
              <div className="checklist-body flex min-w-0 flex-1 flex-col gap-1.5 text-left text-[15px] leading-relaxed text-slate-700 dark:text-slate-300 [&_code]:inline [&_code]:whitespace-normal [&_p]:my-0 [&_p]:w-full [&_p]:leading-relaxed [&_p]:pl-0">
                {rest}
              </div>
            </div>
          </li>
        )
      }
      return (
        <li
          className={
            taskItem
              ? `flex list-none items-start gap-2 pl-0 [&>p]:my-0 ${className ?? ''}`
              : `pl-1 [&>p]:my-2 ${className ?? ''}`
          }
        >
          {children}
        </li>
      )
    },
    blockquote({ children }) {
      return (
        <blockquote className="my-6 border-l-4 border-accent/70 bg-slate-50/95 py-3 pl-4 pr-4 text-[15px] leading-7 text-slate-700 shadow-sm dark:border-accent-mint/55 dark:bg-slate-800/50 dark:text-slate-200">
          {children}
        </blockquote>
      )
    },
    hr() {
      return (
        <hr className="my-10 border-0 border-t border-slate-200 dark:border-slate-600" />
      )
    },
    a({ href, children }) {
      if (!href) {
        return <span className="text-ink dark:text-slate-200">{children}</span>
      }
      if (/^https?:\/\//i.test(href)) {
        return (
          <a
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            className={linkClass}
          >
            {children}
          </a>
        )
      }
      if (href.startsWith('/')) {
        return (
          <Link to={href} className={linkClass}>
            {children}
          </Link>
        )
      }
      return (
        <a href={href} className={linkClass}>
          {children}
        </a>
      )
    },
    img({ src, alt, title }) {
      const resolved = resolveAssetUrl(src ?? '')
      const imgEl = (
        <img
          src={resolved}
          alt={alt ?? ''}
          title={title}
          loading="lazy"
          className="max-h-[min(70vh,520px)] w-auto max-w-full rounded-xl border border-slate-200/90 bg-white object-contain shadow-sm dark:border-slate-600 dark:bg-slate-900"
        />
      )
      if (title) {
        return (
          <figure className="my-8">
            {imgEl}
            <figcaption className="mt-2 text-center text-sm text-ink-soft dark:text-slate-400">
              {title}
            </figcaption>
          </figure>
        )
      }
      return <div className="my-8">{imgEl}</div>
    },
    code({ inline, className, children, ...props }) {
      const isFenced =
        Boolean(className && /\blanguage-[\w-]+\b/.test(className))
      if (inline === true || (inline == null && !isFenced)) {
        return (
          <code
            className="inline whitespace-normal rounded-md border border-slate-200/90 bg-slate-100 px-1.5 py-0.5 align-baseline font-mono text-[0.8125em] font-medium leading-normal text-sky-800 [overflow-wrap:anywhere] dark:border-slate-600 dark:bg-slate-800/95 dark:text-sky-300"
            {...props}
          >
            {children}
          </code>
        )
      }
      return (
        <code
          className={`block font-mono text-[13px] leading-6 text-slate-800 dark:text-slate-100 ${className ?? ''}`}
          {...props}
        >
          {children}
        </code>
      )
    },
    pre({ children }) {
      return (
        <pre className="my-6 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-inner dark:border-slate-600 dark:bg-slate-900/90">
          {children}
        </pre>
      )
    },
    table({ children }) {
      return (
        <div className="my-8 overflow-x-auto rounded-xl border border-slate-200/90 shadow-sm dark:border-slate-600">
          <table
            className={
              checklistStyle
                ? 'w-full min-w-0 max-w-full border-collapse text-left text-[15px] leading-relaxed [&_td:nth-child(1)]:w-14 [&_td:nth-child(1)]:text-center [&_td:nth-child(1)]:align-middle [&_th:nth-child(1)]:w-14 [&_th:nth-child(1)]:text-center'
                : 'w-full min-w-[36rem] border-collapse text-left text-[14px]'
            }
          >
            {children}
          </table>
        </div>
      )
    },
    thead({ children }) {
      return (
        <thead className="bg-slate-50 dark:bg-slate-800/90">{children}</thead>
      )
    },
    tbody({ children }) {
      return <tbody>{children}</tbody>
    },
    tr({ children }) {
      return (
        <tr className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/35">
          {children}
        </tr>
      )
    },
    th({ children }) {
      return (
        <th className="border-b border-slate-200 px-4 py-3 align-middle text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-600 dark:text-slate-300">
          {children}
        </th>
      )
    },
    td({ children }) {
      return (
        <td className="border-b border-slate-100 px-4 py-3 align-middle text-slate-700 dark:border-slate-700/80 dark:text-slate-300">
          {children}
        </td>
      )
    },
    input({ type, checked, ...props }) {
      if (type === 'checkbox') {
        return (
          <input
            type="checkbox"
            checked={checked}
            readOnly
            disabled
            className={
              checklistStyle
                ? 'h-5 w-5 shrink-0 cursor-default rounded border-2 border-teal-400/80 text-teal-600 accent-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-400/40 disabled:opacity-100 dark:border-teal-500 dark:text-teal-400 dark:accent-teal-400'
                : 'mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-accent dark:border-slate-500'
            }
            {...props}
          />
        )
      }
      return <input type={type} {...props} />
    },
    strong({ children }) {
      return (
        <strong className="font-semibold text-ink dark:text-slate-100">
          {children}
        </strong>
      )
    },
    em({ children }) {
      return <em className="italic">{children}</em>
    },
    del({ children }) {
      return (
        <del className="text-slate-500 line-through dark:text-slate-500">
          {children}
        </del>
      )
    },
  }
}

/**
 * @param {'default' | 'nextSteps'} variant — `nextSteps` enables task-list / next-steps table styling and allows raw HTML (e.g. checkboxes in tables).
 */
export default function DevlogMarkdownBody({ markdown, variant = 'default' }) {
  const checklistStyle = variant === 'nextSteps'
  const components = useMemo(
    () => createMarkdownComponents({ checklistStyle }),
    [checklistStyle],
  )

  const remarkPlugins = useMemo(
    () =>
      checklistStyle
        ? [remarkGfm]
        : [remarkGfm, remarkBreaks],
    [checklistStyle],
  )

  const rehypePlugins = useMemo(
    () =>
      checklistStyle ? [rehypeSlug, rehypeRaw] : [rehypeSlug],
    [checklistStyle],
  )

  return (
    <div
      className={
        checklistStyle
          ? 'markdown-doc devlog-md-next-steps max-w-none'
          : 'markdown-doc max-w-none'
      }
    >
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={components}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}
