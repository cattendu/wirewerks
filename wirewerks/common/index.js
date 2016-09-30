// if the module has no dependencies, the above pattern can be simplified to
(function (root, factory) {
	if (typeof define === 'function' && define.amd) {
		// AMD. Register as an anonymous module.
		define([], factory);
	} else if (typeof module === 'object' && module.exports) {
		// Node. Does not work with strict CommonJS, but
		// only CommonJS-like environments that support module.exports,
		// like Node.
		module.exports = factory();
	} else {
		// Browser globals (root is window)
		root.common = factory();
	}
}(this, function () {

	/**
	 * Minimum required to distinguish different parts with same id
	 */
	class PartInfo {
		constructor(part, category) {
			this.part = part
			this.category = category
		}
	}

	/**
	 *
	 */
	class PartService {
		constructor() {
		}

		validate(value, part) {
			//here we can use regexp to check
			if (!value || value == 0)
				return false

			var numberOfDigit = this.numberOfDigit(part)
			if (part.allowDecimal) {
				if (value.indexOf(".") >= 0) {
					var decimalPart = value.split(".")[1]
					if (!decimalPart || decimalPart == 0)
						return false
				}

				var re = new RegExp('^\\d{1,' + numberOfDigit + "}(\\.[0-9][0-9]?)?$");
				return re.test(value)
			}
			else {
				var re = new RegExp('^\\d{1,' + numberOfDigit + "}$");
				return re.test(value)
			}
		}

		numberOfDigit(part) {
			return _.countBy(part.value)['X'];
		}

		static get instance() {return PartService._instance ? PartService._instance : PartService._instance = new PartService}
	}

	/**
	 * Handles product validation <mind blown>
	 */
	class ProductValidation {
		constructor(product, rule) {
			this.product = product
			this.rule = rule						// Rule for this product
			this.validPartsMap = {}
			this.selection = {}				// Last used selection (cached)
		}

		/**
		 * Validate a part in a category considering a set of parts
		 *
		 * @param category
		 * @param part
		 * @param selection Object Map between category and its part --> {category.title: part.value}
		 * @returns {boolean}
		 */
		validate(category, part, selection) {
			if (!this.rule)
				return true

			if (this.rule[category]) {
				var currentRulesArray = this.rule[category][part]
				var defaultRulesArray = this.rule[category]["*"]

				if (!currentRulesArray && !defaultRulesArray)
					return true

				currentRulesArray = currentRulesArray ? currentRulesArray : {}
				defaultRulesArray = defaultRulesArray ? defaultRulesArray : {}

				for (var key in selection) {
					if (selection.hasOwnProperty(key)) {
						var whichRule = currentRulesArray[key] ? currentRulesArray[key] : defaultRulesArray[key]
						if (whichRule) {
							//check if AND clause
							//see if the value affects anything
							if (whichRule[selection[key]]) {
								//check if there'a an AND clause
								var andArray = whichRule[selection[key]]["&"]
								if (andArray) {
									for (var key2 in andArray) {
										if (andArray.hasOwnProperty(key2)) {
											if (selection[andArray[key2].category] &&
											selection[andArray[key2].category] == andArray[key2].value)
												if (andArray[key2].valid == false)
													return false
										}
									}
								}

								if (whichRule[selection[key]].valid == false)
									return false
							}
							else if (whichRule["*"] && whichRule["*"].valid == false)
								return false
						}
					}
				}
			}

			return true
		}

		createValidationMap(selection) {
			this.validPartsMap = {}

			this.product.partGroups.forEach((group) => {
				group.partCategories.forEach((category) => {

					if (!category.parts)
						return;
					category.parts.forEach((part) => {

						var isValid = this.validate(category.title, part.value, selection)
						if (!this.validPartsMap[category.title]) {
							this.validPartsMap[category.title] = {}
						}


						this.validPartsMap[category.title][part.value] = {}
						this.validPartsMap[category.title][part.value]['valid'] = isValid
						if (isValid) {
							if (!this.validPartsMap[category.title]['number']) {
								this.validPartsMap[category.title]['number'] = 1
								this.validPartsMap[category.title]['default'] = part.value
								this.validPartsMap[category.title][part.value]['part'] = part
							}
							else
								this.validPartsMap[category.title]['number']++
						}
					})
				})
			})

			this.selection = _.clone(selection)			// Cache
		}

		// Using cached map
		valid(category, part) {
			return _.keys(this.selection).length === 0 || (this.validPartsMap[category] && this.validPartsMap[category][part]['valid'] === true)
		}
	}

	/**
	 * Parses part number
	 *        ex: FA-ABCDEE9GGGLCB
	 *
	 *        Can accept partial part number.
	 *        		ex: F-1DR
	 */
	class PartNumber {
		constructor(product, productRegex, validator) {
			this.product = product
			this.regex = productRegex
			this.validator = validator
		}

		/**
		 * Parse part number and creates a list of parts for every category
		 */
		parse(partnumber) {
			if (!this.regex)
				return []

			if (!this.validator)
				return []

			// TODO: see if we can put it back
			//var productRegex = new RegExp(this.regex)
			//if (!productRegex.test(partnumber))
			//	return []

			var result = []

			this.selection = {}
			this.validator.createValidationMap(this.selection)

			var partnumberCleaned = partnumber.replace(/-/g, '')
			var startIndex = 0
			result.errors = ""
			this.product.partGroups.forEach((group) => {
				group.partCategories.forEach((category) => {
					if (category.constant) {
						//move forward
						startIndex += category.title.length
					}
					else {
						var length = category['length']
						var value = partnumberCleaned.substr(startIndex, length)

						category.parts.forEach(part => {
							var valueToCheck = value
							if (part.xIsDigit) {
								valueToCheck = value.replace(/[0-9]/g, "X")
							}

							if (part.value == valueToCheck) {
								var valid = this.validator.valid(category.title, part.value, this.selection)
								if (!valid) {
									result.errors += "<br>" + category.title
									return
								}

								if (part.xIsDigit) {

									if (part.allowDecimal && partnumberCleaned[startIndex + length] == 'D') {
										//now we have to extract more
										length = length + 3
										value = partnumberCleaned.substr(startIndex, length)
									}

									var cleanedValue = part.allowDecimal ? value.replace('D', '.') : value.replace(/\D/g, '')
									if (!PartService.instance.validate(cleanedValue, part))
										return

									part.inputValue = value
									part.inputValueValid = true
								}

								var partInfo = new PartInfo(part, category)
								this.validator.createValidationMap(this.selection)			// Rebuild validation cache when parts change
								result.push(partInfo)
							}
						})

						startIndex += length
					}
				})
			})

			return result
		}
	}

	return {
		PartInfo: PartInfo,
		PartNumber: PartNumber,
		PartService: PartService,
		ProductValidation: ProductValidation
	};
}));
