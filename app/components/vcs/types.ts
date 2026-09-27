/** Shared option shape for VcsSelect (and future choice controls). */
export interface VcsSelectOption {
  label: string
  value: string | number
  disabled?: boolean
}
