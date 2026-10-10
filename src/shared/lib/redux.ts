import type { Dispatch } from '@reduxjs/toolkit'
import { useDispatch, useSelector } from 'react-redux'

export const useAppDispatch = useDispatch.withTypes<Dispatch>()
export const useAppSelector = useSelector
