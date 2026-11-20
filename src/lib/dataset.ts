export interface DatasetSummary {
  fileName: string
  rowCount: number
  totalViews: number
  totalLikes: number
  totalComments: number
  engagementRate: number
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

  row.push(value.trim())
  if (row.some((cell) => cell.length > 0)) rows.push(row)
  return rows
}

function numericValue(value: string | undefined): number {
  if (!value) return 0
  const parsed = Number(value.replace(/[,\s$%]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
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

  if (viewsColumn < 0 && likesColumn < 0 && commentsColumn < 0) {
    throw new Error(
      "Add at least one metrics column named views, likes, or comments.",
    )
  }

  const dataRows = rows.slice(1).filter((row) => row.some(Boolean))
  const totalViews = dataRows.reduce(
    (total, row) => total + numericValue(row[viewsColumn]),
    0,
  )
  const totalLikes = dataRows.reduce(
    (total, row) => total + numericValue(row[likesColumn]),
    0,
  )
  const totalComments = dataRows.reduce(
    (total, row) => total + numericValue(row[commentsColumn]),
    0,
  )

  return {
    fileName,
    rowCount: dataRows.length,
    totalViews,
    totalLikes,
    totalComments,
    engagementRate:
      totalViews > 0 ? ((totalLikes + totalComments) / totalViews) * 100 : 0,
    headers,
    preview: dataRows.slice(0, 5).map((row) =>
      headers.map((_, index) => row[index] ?? ""),
    ),
  }
}
