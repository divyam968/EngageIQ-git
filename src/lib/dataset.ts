export interface DatasetSummary {
  fileName: string
  rowCount: number
  totalViews: number
  totalLikes: number
  totalComments: number
  engagementRate: number | null
  headers: string[]
  preview: string[][]
}

function parseRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let value = ""
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]

    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        value += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (character === delimiter && !quoted) {
      row.push(value.trim())
      value = ""
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1
      row.push(value.trim())
      if (row.some((cell) => cell.length > 0)) rows.push(row)
      row = []
      value = ""
    } else {
      value += character
    }
  }

  if (quoted) {
    throw new Error("The CSV/TSV file contains an unclosed quoted field.")
  }
  row.push(value.trim())
  if (row.some((cell) => cell.length > 0)) rows.push(row)
  return rows
}

function numericValue(
  value: string | undefined,
  rowNumber: number,
  columnName: string,
): number {
  const raw = value?.trim() ?? ""
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(raw)) {
    throw new Error(
      `Row ${rowNumber} needs a non-negative whole-number value in the ${columnName} column.`,
    )
  }
  const normalized = raw.replaceAll(",", "")
  const parsed = Number(normalized)
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(
      `Row ${rowNumber} has a ${columnName} value outside the supported range.`,
    )
  }
  return parsed
}

function findColumn(headers: string[], names: string[]): number {
  const normalized = headers.map((header) =>
    header.toLowerCase().replace(/[\s_-]+/g, ""),
  )
  return normalized.findIndex((header) => names.includes(header))
}

export function analyzeDataset(
  text: string,
  fileName: string,
): DatasetSummary {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ""
  const delimiter =
    firstLine.includes("\t") && firstLine.split("\t").length > firstLine.split(",").length
      ? "\t"
      : ","
  const rows = parseRows(text.replace(/^\uFEFF/, ""), delimiter)
  const headers = rows[0]

  if (!headers || rows.length < 2) {
    throw new Error("The file needs a header row and at least one data row.")
  }

  const viewsColumn = findColumn(headers, [
    "views",
    "viewcount",
    "totalviews",
  ])
  const likesColumn = findColumn(headers, ["likes", "likecount", "totallikes"])
  const commentsColumn = findColumn(headers, [
    "comments",
    "commentcount",
    "totalcomments",
  ])

  if (viewsColumn < 0 || likesColumn < 0 || commentsColumn < 0) {
    throw new Error(
      "The file needs views, likes, and comments columns to calculate engagement accurately.",
    )
  }

  const dataRows = rows.slice(1).filter((row) => row.some(Boolean))
  const totals = dataRows.reduce(
    (total, row, index) => {
      const rowNumber = index + 2
      total.views += numericValue(row[viewsColumn], rowNumber, "views")
      total.likes += numericValue(row[likesColumn], rowNumber, "likes")
      total.comments += numericValue(
        row[commentsColumn],
        rowNumber,
        "comments",
      )
      if (
        !Number.isSafeInteger(total.views) ||
        !Number.isSafeInteger(total.likes) ||
        !Number.isSafeInteger(total.comments)
      ) {
        throw new Error("The dataset totals exceed the supported count range.")
      }
      return total
    },
    { views: 0, likes: 0, comments: 0 },
  )

  return {
    fileName,
    rowCount: dataRows.length,
    totalViews: totals.views,
    totalLikes: totals.likes,
    totalComments: totals.comments,
    engagementRate:
      totals.views > 0
        ? ((totals.likes + totals.comments) / totals.views) * 100
        : null,
    headers,
    preview: dataRows.slice(0, 5).map((row) =>
      headers.map((_, index) => row[index] ?? ""),
    ),
  }
}
