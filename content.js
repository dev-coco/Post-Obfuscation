/* global XMLHttpRequest */

(function () {
  // 保存原始 XHR send 引用
  const origSend = XMLHttpRequest.prototype.send
  // 重写 send 方法
  XMLHttpRequest.prototype.send = function (body) {
    if (typeof body === 'string') {
      try {
        // 判断是否发帖请求
        if (body.includes('ComposerStoryCreateMutation')) {
          // 个人账号
          // 解析请求参数
          const param = new URLSearchParams(body)
          // 获取 variables 参数
          const variablesJson = JSON.parse(param.get('variables'))
          const orig = variablesJson.input.message.text
          // 如果发帖的时候没有设置引导语，跳过
          if (!orig) return origSend.call(this, body)
          // 混淆文本
          const obfText = encodeText(variablesJson.input.message.text, uuid())
          // 用混淆后的文本替换掉原始文本
          variablesJson.input.message.text = obfText
          // 重新设置到原始的请求体
          param.set('variables', JSON.stringify(deepReplaceStrings(variablesJson, orig, obfText)))
          body = param.toString()
        } else if (body.includes('CometComposerInterceptionRequestHandlerQuery')) {
          // 专页账号
          // 解析请求参数
          const param = new URLSearchParams(body)
          // 获取 variables 参数
          const variablesJson = JSON.parse(param.get('variables'))
          const orig = variablesJson.params.post_text
          // 如果发帖的时候没有设置引导语，跳过
          if (!orig) return origSend.call(this, body)
          // 混淆文本
          const obfText = encodeText(variablesJson.params.post_text, uuid())
          // 用混淆后的文本替换掉原始文本c
          variablesJson.params.post_text = obfText
          // 重新设置到原始的请求体
          param.set('variables', JSON.stringify(deepReplaceStrings(variablesJson, orig, obfText)))
          body = param.toString()
        }
      } catch (error) {
        console.error('解析 XHR body 出错', error)
      }
    }
    return origSend.call(this, body)
  }
})()

/**
 * @description 深度替换对象或数组结构中的字符串值
 * @param {any} node - 输入的节点，可以是字符串、数组、对象或其他类型
 * @param {string} from - 需要被替换的目标字符串
 * @param {string} to - 替换后的字符串
 * @returns {any} - 替换完成后的节点，保持原始结构
 */
function deepReplaceStrings (node, from, to) {
  if (node == null) return node
  if (typeof node === 'string') return node === from ? to : node
  if (Array.isArray(node)) return node.map(n => deepReplaceStrings(n, from, to))
  if (typeof node === 'object') {
    for (const k of Object.keys(node)) node[k] = deepReplaceStrings(node[k], from, to)
  }
  return node
}

// 生成一个随机的 UUID
function uuid () {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (str) {
    const randomInt = (Math.random() * 16) | 0
    if (str === 'x') {
      str = randomInt
    } else {
      str = (randomInt & 3) | 8
    }
    return str.toString(16)
  })
}

/**
 * @description 将字节码转换为 Unicode 变体选择符
 * @param {number} byte - 字节码 (0–255)
 * @returns {string|null} - 对应的变体选择符，超出范围时返回 null
 */
function variationSelector (byte) {
  if (byte >= 0 && byte < 16) {
    return String.fromCodePoint(65024 + byte)
  } else if (byte >= 16 && byte < 256) {
    return String.fromCodePoint(917760 + byte - 16)
  } else {
    return null
  }
}

/**
 * @description Fisher-Yates 洗牌算法
 *  - 从数组末尾依次选一个随机位置 j（0 ≤ j ≤ i)
 *  - 将当前位置 i 的元素与 j 位置的元素交换
 *  - 使用按位异或 XOR 交换法
 *  - 元素相同则跳过，避免 XOR 把值变为 0
 * @param {any[]} array - 要打乱的数组
 * @returns {void} - 直接修改原数组，不返回新数组
 */
function shuffleArray (array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    // 使用位运算交换
    if (array[i] !== array[j]) {
      array[i] ^= array[j]
      array[j] ^= array[i]
      array[i] ^= array[j]
    }
  }
}

/**
 * @description 将文本隐藏在原始文本里
 * @param {string} origText - 原始文本
 * @param {string} hiddenText - 要隐藏的文本
 * @returns {string} - 包含隐藏文本的字符串
 */
function encodeText (origText, hiddenText) {
  if (!origText || !hiddenText) return

  // 将字符串转换为 UTF-8 字节
  const bytes = new TextEncoder().encode(hiddenText)

  // 将字符串转换为数组（只转换一次）
  const origTextChars = Array.from(origText)
  const origTextLength = origTextChars.length
  const bytesLength = bytes.length

  // 预先计算所有变体选择码
  const selectors = new Array(bytesLength)
  for (let i = 0; i < bytesLength; i++) {
    selectors[i] = variationSelector(bytes[i])
  }

  // 如果隐藏文本字节少于原始文本，使用随机算法分散
  if (bytesLength <= origTextLength) {
    // 创建位置数组并打乱
    const positions = new Array(origTextLength)
    for (let i = 0; i < origTextLength; i++) {
      positions[i] = i
    }
    shuffleArray(positions)

    // 选择前字节长度的位置并排序
    const selectedPositions = positions.slice(0, bytesLength)
    selectedPositions.sort((a, b) => a - b)

    // 创建 Set 用于快速查找
    const positionSet = new Set(selectedPositions)

    // 使用数组构建结果
    const result = []
    let byteIndex = 0

    for (let i = 0; i < origTextLength; i++) {
      result.push(origTextChars[i])

      if (positionSet.has(i) && byteIndex < bytesLength) {
        if (selectors[byteIndex]) {
          result.push(selectors[byteIndex])
        }
        byteIndex++
      }
    }

    return result.join('')
  } else {
    // 如果隐藏文字字节多于原始文本
    const result = []
    let byteIndex = 0

    // 先处理能均匀分配到原始字符的字节
    for (let i = 0; i < origTextLength; i++) {
      result.push(origTextChars[i])

      if (byteIndex < bytesLength && selectors[byteIndex]) {
        result.push(selectors[byteIndex])
        byteIndex++
      }
    }

    // 将剩余的字节全部加到末尾
    while (byteIndex < bytesLength) {
      if (selectors[byteIndex]) {
        result.push(selectors[byteIndex])
      }
      byteIndex++
    }

    return result.join('')
  }
}
