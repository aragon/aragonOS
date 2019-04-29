const getEventArgument = (receipt, event, arg) => receipt.logs.find(l => l.event === event).args[arg]

module.exports = {
  getEventArgument
}
