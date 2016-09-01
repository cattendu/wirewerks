define([
	'angular',
	'fastclick',
	'chroma',
	'./app',
	'./lib/url',
	'./lib/categorycolors',
	'./lib/routes',
	'./lib/search',
	'./lib/resources'
], function(ng, FastClick, chroma, app, Url, CategoryColors, search, resources) {
	app.run(() => {
		FastClick.attach(document.body)
	})

	function filterProductsBySection(products, section) {
		return _.filter(products, (product) => {
			return product.section === section.id
		})
	}

	var views = {
		product: 'product',
		cart: 'cart',
		home: 'home'
	}

	class Application {
		constructor($location) {
			this.$location = $location
			this.view = views.home
			this.filters = {section: undefined}								// Search filters (ie: section, etc...)
		}

		goToHome() {this.$location.path("/state/home");}
		goToCart() {this.$location.path("/state/cart");}
		goToProducts(id) {
			id = id || 'fa'
			if (id)
				id = '/' + id

			this.$location.path("/state/product" + id);
		}


		/**
		 * Toggle between cart/product
		 */
		toggleCart() {
			if (this.view === views.cart)
				this.goToProducts()
			else
				this.goToCart()
		}

	}

	app.service('app', Application)

	/**
	 *
	 */
	class wwApp {
		constructor($timeout, $routeParams, $scope, $location, app) {
			this.id = ''
			this.app = app

			// Should be removed at some point...
			$scope.$watch(() => $routeParams, (params) => {
				// Route params changed...
				if (params.productId)
					this.id = params.productId
			}, true)

			$scope.$watch(() => this.id, (id) => {
				if (!id) {
					return
				}

				this.app.goToProducts(id)
			})
		}
	}

	app.component('wwApp', {
		controller: wwApp,
		templateUrl: 'app/views/app.html',
		bindings: {}
	})

	/**
	 *
	 */
	class Home {
		constructor(app) {
			this.app = app
		}
	}

	app.component('wwHome', {
		controller: Home,
		templateUrl: 'app/views/home.html',
		bindings: {}
	})

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
	class Order {
		constructor(productResource, $scope, cart) {
			this.productResource = productResource
			this.product = undefined;
			this.parts = []							// Type PartInfo, not part (to include category..)

			this.sections = []
			this.cart = cart
			this.partNumber = ""

			$scope.$watch('order.productId', this._refreshProduct.bind(this))
		}

		_refreshProduct() {
			this.productResource.get(this.productId).then(product => {
				// If no product found, keep current product displayed
				if (product) {
					this.sections = []
					this.parts = []
					this.product = product				// Not actually product, more like productTemplate
				}
			})
		}

		// Give a group id (ascending) from a category according to current product
		_groupId(category) {
			if (!this.product) return

			return _.find(this.product.partGroups, (group) => {
				var found = _.find(group.partCategories, (productCategory) => productCategory === category.type)
				if (found)
					return group.id
			})
		}

		/**
		 * Remove all parts related to a category
		 */
		_removeCategory(category) {
			_.remove(this.parts, (partInfo) => {
				return partInfo.category.type === category.type
			})
		}

		_partForCategory(category) {
			return _.find(this.parts, (partInfo) => {
				return partInfo.category.type === category.type
			})
		}

		updatePart(partInfo) {
			this._removeCategory(partInfo.category)
			this.sections = []

			this.parts.push(partInfo)
		}

		addPart(partInfo) {
			if (!partInfo.part.inputValue && this.isPartInOrder(partInfo)) {return}
			this.updatePart(partInfo)
		}

		isPartInOrder(partInfo) {
			return this.parts.some((orderPart) => {
				return 	orderPart.part.value === partInfo.part.value &&
							orderPart.category.type === partInfo.category.type
			})
		}

		verifyOrder() {
			return this.sections.every((section) => {
				if(!section.constant && !section.selected)
					return false
				return true
			})
		}

		addToCart() {
			this.cart.addToCart(this.partNumber)
		}

		orderNumber() {
			if (!this.product) return
			if (this.sections.length)
				return this.sections

			this.partNumber = ""
			var sections = this.sections

			var first = true
			this.product.partGroups.forEach((group) => {
				if (!first) {
					sections.push({label: '-', data: group, constant: true})
					this.partNumber += '-'
				}
				first = false

				group.partCategories.forEach((category) => {

					if (category.constant) {
						sections.push({
							label: category.title,
							data: this.product,
							constant : true
						})
						this.partNumber += category.title
					}
					else {
						var partInfo = this._partForCategory(category)

						var label = _.repeat(category.type, category.length)
						var selected = false
						if (partInfo) {
							if(partInfo.part.xIsDigit) {
								if(partInfo.part.inputValueValid)
								{
									label = partInfo.part.inputValue.toUpperCase()
									selected = true
								}
							}
							else {
								label = partInfo.part.value.toUpperCase()
								selected = true
							}

						}

						var color = category.color || CategoryColors.fromCategoryType(category.type)
						color = chroma(color.hex())		// Clone to modify
						if (!selected) {
							color = color.brighten(1.5)
							color.alpha(0.25)
						} else {
							color.alpha(0.75)
						}

						sections.push({
							label: label,
							classes: 'part',
							selected: selected,
							color: color.css(),
							data: {part: partInfo, category: category}
						})
						this.partNumber += label
					}
				})
			})
			return sections
		}
	}

	app.component('wwOrder', {
		controller: Order,
		controllerAs: 'order',
		templateUrl: 'app/views/order.html',
		bindings: {
			productId: '='
		}
	})

	/**
	 *
	 */
	class OrderNumber {
		constructor() {

		}
	}

	app.component('wwOrderNumber', {
		controller: OrderNumber,
		templateUrl: 'app/views/ordernumber.html',
		require: {
			order: '^wwOrder'
		},
		bindings: {
		}
	})

	/**
	 *
	 */
	class Product {
		constructor() {
		}

		getDataSheetLink() {
			if (!this.product) {
				return
			}

			return Url.datasheet(this.product.dataSheetLink)
		}
	}

	app.component('wwProduct', {
		controller: Product,
		templateUrl: 'app/views/product.html',
		require: {
			order: '^wwOrder'
		},
		bindings: {
			product: '=?'
		}
	})

	/**
	 *
	 */
	class PartGroup {
		constructor() {

		}

		validCategories() {
			var valid = _.filter(this.group.partCategories, (category) => !category.constant)
			return valid
		}
	}

	app.component('wwPartGroup', {
		controller: PartGroup,
		templateUrl: 'app/views/partgroup.html',
		bindings: {
			group: '=?'
		}
	})

	/**
	 *
	 */
	class PartCategory {
		constructor($scope) {
			$scope.$watch('$ctrl.category', category => {
				if (!category) {
					return
				}

				category.color = CategoryColors.fromCategoryType(category.type);

				if (category.parts) {
					category.parts.forEach(part => {
						part.color = category.color.brighten(1.5)
					})
				}
			})
		}

		style() {
			if (!this.category) {
				return
			}

			return {background: this.category.color.css()}
		}
	}

	app.component('wwPartCategory', {
		controller: PartCategory,
		templateUrl: 'app/views/partcategory.html',
		bindings: {
			category: '=?',
			group: '=?'
		}
	})

	/**
	 *
	 */
	class Part {
		constructor() {
			this.inputValue=null
			this.decimal = false
		}

		get partInfo() {
			return new PartInfo(this.part, this.category)
		}

		select() {
			this.order.addPart(this.partInfo)
		}

		shouldShowXIsDigit() {
			return (this.part.xIsDigit && this.isSelected());
		}

		getSuffix() {
			return this.part.value.substring(this.numberOfDigit())
		}

		validate(value) {
			//here we can use regexp to check
			if(!value || value == 0)
				return false

			if(this.part.allowDecimal)
			{
				var re = new RegExp('^\\d{1,' + this.numberOfDigit() + "}(\\.[0-9][0-9]?)?$");
				return re.test(value)
			}
			else
			{
				var re = new RegExp('^\\d{1,' + this.numberOfDigit() + "}$");
				return re.test(value)
			}
		}

		valueChange() {

			//This happens when we delete or backspace

			//this.order.updatePart(this.partInfo)
			if (this.inputValue.indexOf(".") < 0)
				this.decimal = false

			this._updateValue()

		}

		_updateValue()
		{
			var maxChars = this.numberOfDigit()
			var maxDecimal = this.decimal ? 2+1 : 0 //includes the period

			if(this.inputValue.length > maxChars + maxDecimal)
			{
				//the keypress is adding a number to big, shift everything to the right
				this.inputValue = this.inputValue.substr(1);

				//if it's decimal we need to move the decimal point too
				if(this.decimal)
					this.inputValue = (this.inputValue * 10).toFixed(2)
			}

			if(!this.validate(this.inputValue)) {
				this.part.inputValue = undefined
				this.part.inputValueValid = false
			} else {
				this.part.inputValue = this.inputValue
				this.part.inputValueValid = true

				function pad(num, size, decimal) {
					var s = num + "";
					while (s.length < size) {
						if(!decimal)
							s = "0" + s;
						else
							s = s + "0"
					}
					return s;
				}

				var splitValue = this.inputValue.split(".")

				if(splitValue[0].length < maxChars)
					splitValue[0] = pad(splitValue[0], maxChars, false)


				this.part.inputValue = splitValue[0]
				if(this.decimal) {
					if(splitValue[1].length > 0 && splitValue[1].length < maxDecimal-1)
						splitValue[1] = pad(splitValue[1], maxDecimal-1, true)

					this.part.inputValue = this.part.inputValue + "." + splitValue[1]
				}

				//Replace dot by D
				this.part.inputValue = this.part.inputValue.replace('.', 'D')

				//Replace non X values by
				var toAppend = this.part.value.replace(/X+/g,'')
				this.part.inputValue += toAppend
			}

			this.order.updatePart(this.partInfo)
		}


		numberOfDigit() {
			return _.countBy(this.part.value)['X'];
		}

		limit($event)
		{
			var element = $event.target

			var keyPress = String.fromCharCode($event.which)
			if(this.part.allowDecimal && !this.decimal && keyPress == '.')
			{
				this.decimal = true
			}
			else if(isNaN(keyPress)) {
				return $event.preventDefault()
			}
			//now we know it's either the decimal or a digit that was input
			this.inputValue = this.inputValue ? this.inputValue : ""
			this.inputValue += keyPress
			this._updateValue()
			$event.preventDefault()
		}

		style() {
			if (!this.part) {
				return
			}

			return {background: this.part.color.css()}
		}

		isSelected() {
			return this.order.isPartInOrder(this.partInfo)
		}
	}

	app.component('wwPart', {
		controller: Part,
		require: {
			order: '^wwOrder'
		},
		templateUrl: 'app/views/part.html',
		bindings: {
			part: '=?',
			group: '=?',
			category: '=?'
		}
	})

	/**
	 *
	 */
	class ProductSelection {
		constructor(productResource, $scope, $element, $timeout, app, productsCache) {
			this.app = app
			this.searchText = this.selectedItem ? this.selectedItem.part : ''
			this.productResource = productResource
			this.$scope = $scope
			this.products = []
			productsCache.get().then(products => {
				this.products = products
			})
		}

		// Sort of hacking way since depending on autocomplete's controller inner workings
		_getAutocomplete() {
			var el = angular.element(this.$element.find('md-autocomplete'))
			var ctrl = el.controller('mdAutocomplete')

			return ctrl
		}

		_showAutocomplete(value) {
			var el = angular.element(this.$element.find('md-autocomplete'))
			var ctrl = el.controller('mdAutocomplete')
			ctrl.hidden = !value
		}

		searchTextChange(text) {

		}

		selectedItemChange(item) {
			this.id = item ? item.part : ''
		}

		query(text) {
			var products = this.products

			// Filter by selected section
			var sectionFilter= this.app.filters.section
			if (sectionFilter) {
				products = filterProductsBySection(products, sectionFilter.id)
			}

			// Filter items that don't match
			var results = _.filter(products, function(product) {
				var re = new RegExp('^' + text, 'i')
				return re.test(product.part)
			})

			return results
		}

		focus(event) {
			this._showAutocomplete(true)
		}

		$onChanges(changes) {
			if (changes.id)
				this.searchText = changes.id.currentValue
		}

		notFoundMessage() {
			var message = 'No products matching "' + this.searchText + '" were found'
			if (this.app.filters.section) {
				message += ' in <em class="heavy">section ' + this.app.filters.section.id + '</em>'
			}

			message += '.'

			return message
		}
	}

	app.component('wwProductSelection', {
		controller: ProductSelection,
		templateUrl: 'app/views/productselection.html',
		bindings: {
			id: '=productId'
		}
	})

	/**
	 *
	 */
	class wwCart {
		constructor(cart, $scope) {
			//get from localStorage
			this.cart = cart
			this.quantityChoice = _.range(1,100);
			this.products = undefined
			this.$scope = $scope
			this.$scope.$watch(()=>this.products, this._updateQuantity.bind(this), true)
		}

		_updateQuantity() {
			if(!this.products)
				return;
			this.cart.updateQuantity(this.products)
		}

		getProducts() {
			//accidentally call watch
			this.products = this.cart.getAllCart()
			return this.products
		}

		isEmpty() {
			var products = this.getProducts()
			if (!products.length)
				return true

			if (!_.keys(products).length)
				return true
		}
	}

	app.component('wwCart', {
		controller: wwCart,
		templateUrl: 'app/views/cart.html',
		require: {
			order: '^wwCart'
		}
	})

	app.service('cart',  class Cart {
		constructor() {
			this.products = undefined;
		}

		updateQuantity(products) {
			localStorage.setItem("myCart2", JSON.stringify(products))
			this.products = undefined;
		}
		getAllCart() {
			if(!this.products)
				this.products = JSON.parse(localStorage.getItem("myCart2"))
			return this.products
		}

		addToCart(completePartNumber) {
			//window.localStorate
			//alert("added to cart: "+ completePartNumber)

			var products = this.getAllCart()
			if (!products)
				products = {}

			if(products[completePartNumber])
				products[completePartNumber].quantity++
			else {
				products[completePartNumber] = {}
				products[completePartNumber].quantity = 1
				products[completePartNumber].name = completePartNumber
				products[completePartNumber].description = "the description"
			}

			this.updateQuantity(products)
		}
	})

	/**
	 *
	 */
	class wwProductNav {
		constructor(app, $scope, $routeParams, productsCache, sectionsCache) {
			// Set the section to the currently viewed product on page refresh
			if (app.view === views.product) {
				productsCache.byId($routeParams.productId).then((product) => {
					sectionsCache.byId(product.section).then((section) => {
						this.section = section
					})
				})
			}

			$scope.$watch(() => this.section, (section) => {
				app.filters.section = section
			})
		}
	}

	app.component('wwProductNav', {
		controller: wwProductNav,
		templateUrl: 'app/views/productnav.html',
	})

	/**
	 *
	 */
	class wwSectionSelection {
		constructor(sectionsCache) {
			sectionsCache.get().then((sections) => {
				this.sections = sections
			})
		}
	}

	app.component('wwSectionSelection', {
		controller: wwSectionSelection,
		templateUrl: 'app/views/sectionselection.html',
		bindings: {
			selected: '=?'
		}
	})

	/**
	 *
	 */
	class wwSectionProducts {
		constructor(app, productsCache, $scope) {
			$scope.$watch(() => this.section, (section) => {
				productsCache.get().then(products => {
					this.products = []

					// Filter by selected section
					if (section) {
						this.products = filterProductsBySection(products, section)
					}
				})
			})
		}
	}

	app.component('wwSectionProducts', {
		controller: wwSectionProducts,
		templateUrl: 'app/views/sectionproducts.html',
		bindings: {
			section: '=?'
		}
	})

	/**
	 *
	 */
	class wwProductListItem {
		constructor(app) {
			this.selectProduct = () => {
				app.goToProducts(this.product.part)
			}
		}
	}

	app.component('wwProductListItem', {
		controller: wwProductListItem,
		templateUrl: 'app/views/productlistitem.html',
		bindings: {
			product: '='
		}
	})
});
