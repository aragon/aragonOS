const getEvents = ({ logs = [] }, event) => logs.filter(l => l.event === event)
const getEventAt = (receipt, event, index = 0) => getEvents(receipt, event)[index]
const getEventArgument = (receipt, event, arg, index = 0) => getEventAt(receipt, event, index).args[arg]
const getNewProxyAddress = (receipt) => getEventArgument(receipt, 'NewAppProxy', 'proxy')

module.exports = {
  getEvents,
  getEventAt,
  getEventArgument,
  getNewProxyAddress
}
