const getEvent = (receipt, event) => getEvents(receipt, event)[0]
const getEvents = (receipt, event) => receipt.logs.filter(l => l.event === event)
const getEventArgument = (receipt, event, arg) => getEvent(receipt, event).args[arg]

module.exports = {
  getEvent,
  getEvents,
  getEventArgument,
}
