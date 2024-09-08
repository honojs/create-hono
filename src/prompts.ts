import type { State } from '@clack/core'
import {
  block,
  ConfirmPrompt,
  isCancel,
  SelectPrompt,
  TextPrompt,
} from '@clack/core'
import isUnicodeSupported from 'is-unicode-supported'
import color from 'picocolors'
import { cursor, erase } from 'sisteransi'

const unicode = isUnicodeSupported()
const s = (c: string, fallback: string) => (unicode ? c : fallback)
const S_STEP_ACTIVE = s('◆', '*')
const S_STEP_CANCEL = s('■', 'x')
const S_STEP_ERROR = s('▲', 'x')
const S_STEP_SUBMIT = s('◇', 'o')

const S_BAR = s('│', '|')
const S_BAR_END = s('└', '—')

const S_RADIO_ACTIVE = s('●', '>')
const S_RADIO_INACTIVE = s('○', ' ')

const symbol = (state: State) => {
  switch (state) {
    case 'initial':
    case 'active':
      return color.cyan(S_STEP_ACTIVE)
    case 'cancel':
      return color.red(S_STEP_CANCEL)
    case 'error':
      return color.yellow(S_STEP_ERROR)
    case 'submit':
      return color.green(S_STEP_SUBMIT)
  }
}

function onCancel() {
  console.log('\nOperation canceled.')
}

interface LimitOptionsParams<TOption> {
  options: TOption[]
  maxItems: number | undefined
  cursor: number
  style: (option: TOption, active: boolean) => string
}

const limitOptions = <TOption>(
  params: LimitOptionsParams<TOption>,
): string[] => {
  const { cursor, options, style } = params

  const paramMaxItems = params.maxItems ?? Infinity
  const outputMaxItems = Math.max(process.stdout.rows - 4, 0)
  // We clamp to minimum 5 because anything less doesn't make sense UX wise
  const maxItems = Math.min(outputMaxItems, Math.max(paramMaxItems, 5))
  let slidingWindowLocation = 0

  if (cursor >= slidingWindowLocation + maxItems - 3) {
    slidingWindowLocation = Math.max(
      Math.min(cursor - maxItems + 3, options.length - maxItems),
      0,
    )
  } else if (cursor < slidingWindowLocation + 2) {
    slidingWindowLocation = Math.max(cursor - 2, 0)
  }

  const shouldRenderTopEllipsis =
    maxItems < options.length && slidingWindowLocation > 0
  const shouldRenderBottomEllipsis =
    maxItems < options.length &&
    slidingWindowLocation + maxItems < options.length

  return options
    .slice(slidingWindowLocation, slidingWindowLocation + maxItems)
    .map((option, i, arr) => {
      const isTopLimit = i === 0 && shouldRenderTopEllipsis
      const isBottomLimit = i === arr.length - 1 && shouldRenderBottomEllipsis
      return isTopLimit || isBottomLimit
        ? color.dim('...')
        : style(option, i + slidingWindowLocation === cursor)
    })
}

interface TextOptions {
  message: string
  placeholder?: string
  defaultValue?: string
  initialValue?: string
  validate?: (value: string) => string | void
}
export const text = (opts: TextOptions) => {
  return new TextPrompt({
    validate: opts.validate,
    placeholder: opts.placeholder,
    defaultValue: opts.defaultValue,
    initialValue: opts.initialValue,
    render() {
      const title = `${color.gray(S_BAR)}\n${symbol(this.state)}  ${opts.message}\n`
      const placeholder = opts.placeholder
        ? color.inverse(opts.placeholder[0]) +
          color.dim(opts.placeholder.slice(1))
        : color.inverse(color.hidden('_'))
      const value = !this.value ? placeholder : this.valueWithCursor

      switch (this.state) {
        case 'error':
          return `${title.trim()}\n${color.yellow(S_BAR)}  ${value}\n${color.yellow(
            S_BAR_END,
          )}  ${color.yellow(this.error)}\n`
        case 'submit':
          return `${title}${color.gray(S_BAR)}  ${color.dim(this.value || opts.placeholder)}`
        case 'cancel':
          return `${title}${color.gray(S_BAR)}  ${color.strikethrough(
            color.dim(this.value ?? ''),
          )}${this.value?.trim() ? '\n' + color.gray(S_BAR) : ''}`
        default:
          return `${title}${color.cyan(S_BAR)}  ${value}\n${color.cyan(S_BAR_END)}\n`
      }
    },
  })
    .prompt()
    .then((result) => {
      if (isCancel(result)) {
        onCancel()
        process.exit(1)
      }
      return result
    })
}

interface ConfirmOptions {
  message: string
  active?: string
  inactive?: string
  initialValue?: boolean
}
export const confirm = (opts: ConfirmOptions) => {
  const active = opts.active ?? 'Yes'
  const inactive = opts.inactive ?? 'No'
  return new ConfirmPrompt({
    active,
    inactive,
    initialValue: opts.initialValue ?? true,
    render() {
      const title = `${color.gray(S_BAR)}\n${symbol(this.state)}  ${opts.message}\n`
      const value = this.value ? active : inactive

      switch (this.state) {
        case 'submit':
          return `${title}${color.gray(S_BAR)}  ${color.dim(value)}`
        case 'cancel':
          return `${title}${color.gray(S_BAR)}  ${color.strikethrough(
            color.dim(value),
          )}\n${color.gray(S_BAR)}`
        default: {
          return `${title}${color.cyan(S_BAR)}  ${
            this.value
              ? `${color.green(S_RADIO_ACTIVE)} ${active}`
              : `${color.dim(S_RADIO_INACTIVE)} ${color.dim(active)}`
          } ${color.dim('/')} ${
            !this.value
              ? `${color.green(S_RADIO_ACTIVE)} ${inactive}`
              : `${color.dim(S_RADIO_INACTIVE)} ${color.dim(inactive)}`
          }\n${color.cyan(S_BAR_END)}\n`
        }
      }
    },
  })
    .prompt()
    .then((result) => {
      if (isCancel(result)) {
        onCancel()
        process.exit(1)
      }
      return result
    }) as Promise<boolean>
}

type Primitive = Readonly<string | boolean | number>

type Option<Value> = Value extends Primitive
  ? { value: Value; label?: string; hint?: string }
  : { value: Value; label: string; hint?: string }

interface SelectOptions<Value> {
  message: string
  options: Option<Value>[]
  initialValue?: Value
  maxItems?: number
}

export const select = <Value>(opts: SelectOptions<Value>) => {
  const opt = (
    option: Option<Value>,
    state: 'inactive' | 'active' | 'selected' | 'cancelled',
  ) => {
    const label = option.label ?? String(option.value)
    switch (state) {
      case 'selected':
        return `${color.dim(label)}`
      case 'active':
        return `${color.green(S_RADIO_ACTIVE)} ${label} ${
          option.hint ? color.dim(`(${option.hint})`) : ''
        }`
      case 'cancelled':
        return `${color.strikethrough(color.dim(label))}`
      default:
        return `${color.dim(S_RADIO_INACTIVE)} ${color.dim(label)}`
    }
  }

  return new SelectPrompt({
    options: opts.options,
    initialValue: opts.initialValue,
    render() {
      const title = `${color.gray(S_BAR)}\n${symbol(this.state)}  ${opts.message}\n`

      switch (this.state) {
        case 'submit':
          return `${title}${color.gray(S_BAR)}  ${opt(this.options[this.cursor], 'selected')}`
        case 'cancel':
          return `${title}${color.gray(S_BAR)}  ${opt(
            this.options[this.cursor],
            'cancelled',
          )}\n${color.gray(S_BAR)}`
        default: {
          return `${title}${color.cyan(S_BAR)}  ${limitOptions({
            cursor: this.cursor,
            options: this.options,
            maxItems: opts.maxItems,
            style: (item, active) => opt(item, active ? 'active' : 'inactive'),
          }).join(`\n${color.cyan(S_BAR)}  `)}\n${color.cyan(S_BAR_END)}\n`
        }
      }
    },
  })
    .prompt()
    .then((result) => {
      if (isCancel(result)) {
        onCancel()
        process.exit(1)
      }
      return result as Value
    })
}

export const spinner = () => {
  const frames = unicode ? ['◒', '◐', '◓', '◑'] : ['•', 'o', 'O', '0']
  const delay = unicode ? 80 : 120

  let unblock: () => void
  let loop: NodeJS.Timeout
  let isSpinnerActive: boolean = false
  let _message: string = ''

  const handleExit = (code: number) => {
    const msg = code > 1 ? 'Something went wrong' : 'Canceled'
    if (isSpinnerActive) stop(msg, code)
  }

  const errorEventHandler = () => handleExit(2)
  const signalEventHandler = () => handleExit(1)

  const registerHooks = () => {
    // Reference: https://nodejs.org/api/process.html#event-uncaughtexception
    process.on('uncaughtExceptionMonitor', errorEventHandler)
    // Reference: https://nodejs.org/api/process.html#event-unhandledrejection
    process.on('unhandledRejection', errorEventHandler)
    // Reference Signal Events: https://nodejs.org/api/process.html#signal-events
    process.on('SIGINT', signalEventHandler)
    process.on('SIGTERM', signalEventHandler)
    process.on('exit', handleExit)
  }

  const clearHooks = () => {
    process.removeListener('uncaughtExceptionMonitor', errorEventHandler)
    process.removeListener('unhandledRejection', errorEventHandler)
    process.removeListener('SIGINT', signalEventHandler)
    process.removeListener('SIGTERM', signalEventHandler)
    process.removeListener('exit', handleExit)
  }

  const start = (msg: string = ''): void => {
    isSpinnerActive = true
    unblock = block()
    _message = msg.replace(/\.+$/, '')
    process.stdout.write(`${color.gray(S_BAR)}\n`)
    let frameIndex = 0
    let dotsTimer = 0
    registerHooks()
    loop = setInterval(() => {
      const frame = color.magenta(frames[frameIndex])
      const loadingDots = '.'.repeat(Math.floor(dotsTimer)).slice(0, 3)
      process.stdout.write(cursor.move(-999, 0))
      process.stdout.write(erase.down(1))
      process.stdout.write(`${frame}  ${_message}${loadingDots}`)
      frameIndex = frameIndex + 1 < frames.length ? frameIndex + 1 : 0
      dotsTimer = dotsTimer < frames.length ? dotsTimer + 0.125 : 0
    }, delay)
  }

  const stop = (msg: string = '', code: number = 0): void => {
    _message = msg ?? _message
    isSpinnerActive = false
    clearInterval(loop)
    const step =
      code === 0
        ? color.green(S_STEP_SUBMIT)
        : code === 1
          ? color.red(S_STEP_CANCEL)
          : color.red(S_STEP_ERROR)
    process.stdout.write(cursor.move(-999, 0))
    process.stdout.write(erase.down(1))
    process.stdout.write(`${step}  ${_message}\n`)
    clearHooks()
    unblock()
  }

  const message = (msg: string = ''): void => {
    _message = msg ?? _message
  }

  return {
    start,
    stop,
    message,
  }
}
