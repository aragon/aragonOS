contract('Company', () => {
  it('should be deployed', async () => {
    const company = await Company.new()
    assert.exists(company.address)
  })
})
