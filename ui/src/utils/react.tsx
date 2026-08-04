import { Fragment, ReactNode } from "react"

export function joinJSX(elements: ReactNode[], separator: ReactNode): ReactNode[] {
  return elements.reduce((acc: ReactNode[], element, index) => {
    if (index === 0) return [element]
    return [...acc, <Fragment key={"sep" + index}>{separator}</Fragment>, element]
  }, [])
}

export function preserveLineBreaks(text: string) {
  return joinJSX(text.split("\n"), <br />)
}
