import { getProject } from '@theatre/core'
import state from './theatreState.json'

export const project = getProject('Ruhama', { state })
export const introSheet = project.sheet('Intro')
