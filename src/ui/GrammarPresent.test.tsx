import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it } from 'vitest'
import { App } from '../jolito'
import { createTestServices } from '../test/services'

beforeEach(() => {
  localStorage.clear()
})

it('keeps a present tense draft through tense selection and interruptions, then grades the conjugated form', async () => {
  window.history.replaceState({}, '', '#/grammar')
  const services = createTestServices()
  const app = render(<App services={services} />)
  const user = userEvent.setup()
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Tense' }),
    'present',
  )
  expect(screen.getByText('Spanish present tense')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Start practice' }))
  await user.type(screen.getByRole('textbox'), 'habl')
  await user.click(screen.getByRole('button', { name: 'Grammar' }))
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Tense' }),
    'preterite',
  )
  expect(
    screen.queryByRole('button', { name: 'Resume practice' }),
  ).not.toBeInTheDocument()
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Tense' }),
    'present',
  )
  await user.click(screen.getByRole('button', { name: 'Resume practice' }))
  fireEvent(document, new Event('visibilitychange'))
  expect(screen.getByRole('textbox')).toHaveValue('habl')
  await user.type(screen.getByRole('textbox'), 'o')
  await user.keyboard('{Enter}')
  expect(
    screen.getByRole('status', { name: 'Answer feedback' }),
  ).toHaveTextContent('hablo')
  await waitFor(() =>
    expect(services.mockSpeaker.spoken.slice(-1)[0]).toEqual({
      text: 'Todos los días yo hablo con la familia por teléfono.',
      locale: 'es-MX',
    }),
  )
  await user.keyboard('4')
  expect(
    services.cards
      .load([])
      .cards.filter((card) => card.grammar?.topic === 'present'),
  ).toHaveLength(1)
  expect(
    services.cards
      .load([])
      .cards.filter((card) => card.grammar?.topic === 'preterite'),
  ).toHaveLength(0)
  expect(
    services.cards
      .load([])
      .cards.filter((card) => card.grammar?.topic === 'perfect'),
  ).toHaveLength(0)
  expect(
    services.cards
      .load([])
      .cards.filter((card) => card.grammar?.topic === 'gerund'),
  ).toHaveLength(0)
  app.unmount()
  const spoken = [...services.mockSpeaker.spoken]
  fireEvent(document, new Event('visibilitychange'))
  fireEvent.keyDown(window, { key: ' ', code: 'Space' })
  expect(services.mockSpeaker.spoken).toEqual(spoken)
})
