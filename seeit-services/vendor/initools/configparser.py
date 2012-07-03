"""
This implements the public `ConfigParser` interface, but with some
additional enhancements.


"""

import codecs
import os
from UserDict import DictMixin
import string
from initools import iniparser
from initools._setmixin import SetMixin

class Error(Exception):
    pass

class NoSectionError(Error):
    """Exception raised when a specified section is not found."""

class DuplicateSectionError(Error):
    """Exception raised if add_section() is called with the name of a
    section that is already present."""

class NoOptionError(Error):
    """Exception raised when a specified option is not found in the
    specified section."""

class InterpolationError(Error):
    """Base class for exceptions raised when problems occur performing
    string interpolation."""

    def __init__(self, option, section, msg):
        Error.__init__(self, msg)
        self.option = option
        self.section = section

class InterpolationDepthError(InterpolationError):
    """Exception raised when string interpolation cannot be completed
    because the number of iterations exceeds
    MAX_INTERPOLATION_DEPTH. Subclass of InterpolationError."""

class InterpolationMissingOptionError(InterpolationError):
    """Exception raised when an option referenced from a value does
    not exist. Subclass of InterpolationError."""

    def __init__(self, option, section, rawval, reference, msg=None):
        if msg is None:
            msg = ("Bad value substitution:\n"
                   "\tsection: [%s]\n"
                   "\toption : %s\n"
                   "\tkey    : %s\n"
                   "\trawval : %s\n"
                   % (section, option, reference, rawval))
        InterpolationError.__init__(self, option, section, msg)
        self.reference = reference

class InterpolationSyntaxError(InterpolationError):
    """Exception raised when the source text into which substitutions
    are made does not conform to the required syntax. Subclass of
    InterpolationError."""

"""Exception raised when errors occur attempting to parse a file."""
ParsingError = iniparser.ParseError

class MissingSectionHeaderError(ParsingError):
    """Exception raised when attempting to parse a file which has no
    section headers."""

## The maximum depth for recursive interpolation for get() when the
## raw parameter is false. This is relevant only for the ConfigParser
## class.
MAX_INTERPOLATION_DEPTH = 10

class _NoDefault:
    def __repr__(self):
        return '(no default)'
_NoDefault = _NoDefault()

class RawConfigParser(object):

    # If this is true then %(DEFAULT_KEY)s will be substituted
    # in values:
    percent_expand = False
    # If this is true then ${section:value} will be substituted
    # in values:
    dollar_expand = False
    # If this is true, then .set(section_that_does_not_exist, ...)
    # will fail; otherwise the section will be implicitly created
    safe_set = False
    # If this is true then a global section is allowed (options
    # defined before any section is defined)
    global_section = False
    # If this is true, then option names are case sensitive:
    case_sensitive = False
    # If this is true, then section names are case sensitive:
    section_case_sensitive = True
    # This is the encoding to expect the file to be in:
    encoding = 'utf8'
    # If true, then comments will be allowed on the same line
    # as a value.  Otherwise comments can only be on their
    # own lines
    inline_comments = True
    # When writing a config file out, this will be used to
    # indent continuation lines:
    continuation_indent = '\t'
    # If this is true, then every section will appear to have
    # the values from [DEFAULT] in it
    inherit_defaults = True
    # This can be True or a string to indicate the name of the
    # config option for extending a section or config file.
    extendable = False
    # If extendable is True, then this value will be used:
    default_extend_name = 'extends'
    # An extends in these sections will be applied globally;
    # in other sections they will only apply to the section
    # itself
    global_extend_section_names = ['', 'global', 'DEFAULT']
    # If a extend is in a section, it will draw from some section;
    # if there is no default section then it will draw from this
    # section.  Use '__name__' to indicate the same name as the
    # section itself.
    default_extend_section_name = 'main'
    # If this is false, then if you do conf.read([filename]) and the
    # filename doesn't exist, an exception (IOError) will be raised.
    ignore_missing_files = True

    def __init__(self, defaults=None,
                 encoding=_NoDefault,
                 percent_expand=_NoDefault,
                 safe_set=_NoDefault,
                 dollar_expand=_NoDefault,
                 case_sensitive=_NoDefault,
                 section_case_sensitive=_NoDefault,
                 global_section=_NoDefault,
                 inline_comments=_NoDefault,
                 inherit_defaults=_NoDefault,
                 extendable=_NoDefault):
        if encoding is not _NoDefault:
            self.encoding = encoding
        if percent_expand is not _NoDefault:
            self.percent_expand = percent_expand
        if safe_set is not _NoDefault:
            self.safe_set = safe_set
        if dollar_expand is not _NoDefault:
            self.dollar_expand = dollar_expand
        if case_sensitive is not _NoDefault:
            self.case_sensitive = case_sensitive
        if section_case_sensitive is not _NoDefault:
            self.section_case_sensitive = section_case_sensitive
        if global_section is not _NoDefault:
            self.global_section = global_section
        if inline_comments is not _NoDefault:
            self.inline_comments = inline_comments
        if inherit_defaults is not _NoDefault:
            self.inherit_defaults = inherit_defaults
        if extendable is not _NoDefault:
            self.extendable = extendable
        if self.extendable:
            if isinstance(self.extendable, basestring):
                self._extends_name = self.extendable
            else:
                self._extends_name = self.default_extend_name
        self._pre_normalized_keys = {}
        self._pre_normalized_sections = {}
        self._key_file_positions = {}
        self._key_comments = {}
        self._section_order = []
        self._section_key_order = {}
        self._section_comments = {}
        self._values = {}
        self.add_section('DEFAULT')
        if defaults is not None:
            for name, value in defaults.items():
                self.set('DEFAULT', name, value)

    def defaults(self):
        """Return a dictionary containing the instance-wide defaults."""
        default = self.sectionxform('DEFAULT')
        return self._values.get(default, {})

    def sections(self):
        """Return a list of the sections available; DEFAULT is not
        included in the list."""
        return [self._pre_normalized_sections[sec]
                for sec in self._section_order
                if sec != self.sectionxform('DEFAULT')]

    def add_section(self, section, comment=None):
        """Add a section named section to the instance.

        If a section by the given name already exists,
        DuplicateSectionError is raised.
        """
        sec = self.sectionxform(section)
        if sec in self._values:
            if self.sectionxform('DEFAULT') == sec:
                # Ignore this one case of duplicates
                return
            raise DuplicateSectionError(
                "A section [%s] already exists"
                % sec)
        self._pre_normalized_sections[sec] = section
        if sec not in self._section_order:
            self._section_order.append(sec)
        self._section_key_order[sec] = []
        self._section_comments[sec] = comment
        self._values[sec] = {}

    def has_section(self, section):
        """Indicates whether the named section is present in the
        configuration.

        The DEFAULT section is not acknowledged.
        """
        if section == 'DEFAULT':
            return False
        return self.sectionxform(section) in self._values

    def options(self, section):
        """Returns a list of options available in the specified
        section."""
        sec = self.sectionxform(section)
        if sec not in self._values:
            raise NoSectionError(
                "Section [%s] does not exist" % sec)
        v = [self._pre_normalized_keys[(sec, op)]
             for op in self._section_key_order[sec]]
        if self.inherit_defaults and self.sectionxform('DEFAULT') != sec:
            v = v[:]
            v.extend(self.options('DEFAULT'))
        return v

    def has_option(self, section, option):
        """If the given section exists, and contains the given option,
        return True; otherwise return False."""
        sec = self.sectionxform(section)
        if self.inherit_defaults and self.sectionxform('DEFAULT') != sec:
            if self.has_option('DEFAULT', option):
                return True
        if sec not in self._values:
            return False
        return self.optionxform(option) in self._values[sec]

    def read(self, filenames, extending=False, map_sections=None):
        """Attempt to read and parse a list of filenames, returning a
        list of filenames which were successfully parsed.

        If filenames is a string or Unicode string, it is treated as a
        single filename. If a file named in filenames cannot be
        opened, that file will be ignored. This is designed so that
        you can specify a list of potential configuration file
        locations (for example, the current directory, the user's home
        directory, and some system-wide directory), and all existing
        configuration files in the list will be read. If none of the
        named files exist, the ConfigParser instance will contain an
        empty dataset. An application which requires initial values to
        be loaded from a file should load the required file or files
        using readfp() before calling read() for any optional files:

          import ConfigParser, os

          config = ConfigParser.ConfigParser()
          config.readfp(open('defaults.cfg'))
          config.read(['site.cfg', os.path.expanduser('~/.myapp.cfg')])

        If ``extending`` is true (default false) then the values
        picked up from the file will *not* override the values already
        present (that means that the file being loaded is extended by
        the already loaded file).
        """
        found = []
        if isinstance(filenames, basestring):
            filenames = [filenames]
        for fn in filenames:
            try:
                fp = self._open(fn)
            except IOError, e:
                if not self.ignore_missing_files:
                    raise
                continue
            found.append(fn)
            try:
                self.readfp(fp, fn, extending=extending,
                            map_sections=map_sections)
            finally:
                fp.close()
        return found

    def _open(self, filename, mode='r'):
        """
        Open a file.  You can override this in a subclass to, for
        example, allow loading configs over HTTP.
        """
        return open(filename, mode)

    def readfp(self, fp, filename='<???>', extending=False,
               map_sections=None):
        """Read and parse configuration data from the file or
        file-like object in fp

        Only the readline() method is used. If filename is omitted and
        fp has a name attribute, that is used for filename; the
        default is '<???>'.
        """
        parser = _ConfigParserParser(self, extending=extending,
                                     map_sections=map_sections)
        parser.loadfile(fp, filename=filename,
                        encoding=self.encoding)
        if self.extendable:
            self._process_extends()

    def _process_extends(self):
        """
        Figure out if there's any extends options in the config
        file, and if so then process those options and remove them.
        """
        extend = self.optionxform(self._extends_name)
        glob_sections = map(
            self.sectionxform, self.global_extend_section_names)
        reads = []
        for section, values in self._values.iteritems():
            if extend in values:
                value = self.getfilename(section, extend)
                if self.sectionxform(section) in glob_sections:
                    reads.append((value, None))
                else:
                    if '#' in value:
                        value, inc_section = value.split('#', 1)
                    else:
                        inc_section = self.default_extend_section_name
                    if inc_section == '__name__':
                        inc_section = section
                    reads.append((value, {inc_section: section}))
                self.remove_option(section, extend)
        for filename, map_sections in reads:
            self.read(filename, extending=True,
                      map_sections=map_sections)

    def get(self, section, option, raw=False, vars=None, _recursion=0):
        """Get an option value for the named section.

        If self.percent_expand is true, then all the '%'
        interpolations are expanded, using the optional vars.  If raw
        is True, then no interpolation is done."""
        if _recursion > MAX_INTERPOLATION_DEPTH:
            raise InterpolationDepthError(
                section, option,
                "Maximum recursion depth for interpolation exceded")
        sec = self.sectionxform(section)
        op = self.optionxform(option)
        if sec not in self._values:
            raise NoSectionError(
                "Section [%s] not found (when looking for option %r)"
                % (section, option))
        values = self._values[sec]
        if op not in values:
            if (self.inherit_defaults
                and self.sectionxform('DEFAULT') != sec
                and self.has_option('DEFAULT', op)):
                value = self.get('DEFAULT', op, raw=True)
            else:
                raise NoOptionError(
                    "Option %r not found (in section [%s])"
                    % (option, section))
        else:
            value = values[op]
        if raw:
            return value
        if self.percent_expand:
            value = self._do_percent_expansion(
                section, option, value, vars, _recursion)
        if self.dollar_expand:
            value = self._do_dollar_expansion(
                section, option, value, vars, _recursion)
        return value

    def _do_percent_expansion(self, section, option, value,
                              vars, _recursion):
        if vars is None:
            vars = {}
        vars = _OptionWrapper(self, vars, section, option, _recursion)
        if not isinstance(value, basestring):
            raise TypeError(
                "Cannot interpolate a non-string [%s] option %s=%r"
                % (section, option, value))
        try:
            return value % vars
        except KeyError, e:
            var = e.args[0]
            raise InterpolationMissingOptionError(
                option, section, value, var,
                "Variable %s not found in [%s] option %s=%s%s"
                % (var, section, option, value,
                   self._get_location_info(section, option)))
        except ValueError, e:
            raise InterpolationSyntaxError(
                option, section,
                "%s in [%s] option %s=%s%s"
                % (e, section, option, value,
                   self._get_location_info(section, option)))

    def _do_dollar_expansion(self, section, option, value,
                             vars, _recursion):
        if vars is None:
            vars = {}
        vars = _SectionOptionWrapper(self, vars, section, option, _recursion)
        if not isinstance(value, basestring):
            raise TypeError(
                "Cannot interpolate a non-string [%s] option %s=%r"
                % (section, option, value))
        try:
            tmpl = string.Template(value)
            return tmpl.substitute(vars)
        except KeyError, e:
            var = e.args[0]
            raise InterpolationMissingOptionError(
                option, section, value, var,
                "Variable %s not found in [%s] option %s=%s%s"
                % (var, section, option, value,
                   self._get_location_info(section, option)))
        except ValueError, e:
            raise InterpolationSyntaxError(
                option, section,
                "%s in [%s] option %s=%s%s"
                % (e, section, option, value,
                   self._get_location_info(section, option)))

    def _get_location_info(self, section, option):
        location = self.setting_location(section, option)
        if location[0]:
            extra = ' (located at %s' % location[0]
            if location[1]:
                extra += ':%s' % location[1]
            extra += ')'
        else:
            extra = ''
        return extra

    def setting_location(self, section, option):
        """
        Returns (filename, line_number) where the given setting was defined.
        May return (None, None) if it's unknown.
        """
        location = self._key_file_positions.get(
            (self.sectionxform(section), self.optionxform(option)),
            (None, None))
        return location

    def getint(self, section, option):
        """A convenience method which coerces the option in the
        specified section to an integer."""
        value = self.get(section, option)
        try:
            return int(value)
        except ValueError:
            loc_info = self._get_location_info(section, option)
            raise ValueError(
                "Could not convert option %s=%s (in [%s]) to an integer%s"
                % (option, value, section, loc_info))

    def getfloat(self, section, option):
        """A convenience method which coerces the option in the
        specified section to a floating point number."""
        value = self.get(section, option)
        try:
            return float(value)
        except ValueError:
            raise ValueError(
                "Could not convert options %s=%s (in [%s]) to a float%s"
                % (option, value, section,
                   self._get_location_info(section, option)))

    def getboolean(self, section, option):
        """A convenience method which coerces the option in the
        specified section to a Boolean value.

        Note that the accepted values for the option are "1", "yes",
        "true", and "on", which cause this method to return True, and
        "0", "no", "false", and "off", which cause it to return
        False. These string values are checked in a case-insensitive
        manner. Any other value will cause it to raise ValueError.
        """
        value = self.get(section, option)
        value = value.strip().lower()
        if value in ('1', 'y', 'yes', 't', 'true', 'on'):
            return True
        elif value in ('0', 'n', 'no', 'f', 'false', 'off'):
            return False
        raise ValueError(
            "Could not convert option %s=%s (in [%s] to a boolean "
            "(use true/false)%s"
            % (option, value, section,
               self._get_location_info(section, option)))

    def getfilename(self, section, option):
        """Returns the value of the option, interpreted as a filename
        relative to the location of where the option was defined.

        Raises a ValueError if the option doesn't have an associated
        filename and the path is not absolute.
        """
        value = self.get(section, option)
        filename = self.setting_location(section, option)[0]
        if filename is None:
            if os.path.isabs(value):
                return value
            raise ValueError(
                "Getting relative filename [%s] option %s=%s , but there "
                "is no recorded config file for option"
                % (section, option, value))
        value = os.path.join(os.path.dirname(filename), value)
        return value

    def items(self, section, raw=False, vars=None):
        """Return a list of (name, value) pairs for each option in the
        given section.

        If self.percent_expand is true, then all the '%'
        interpolations are expanded, using the optional vars.  If raw
        is True, then no interpolation is done.
        """
        result = []
        for op in self.options(section):
            result.append((op, self.get(section, op, raw=raw, vars=vars)))
        return result

    def allitems(self, raw=False, vars=None):
        result = {}
        for section in self.sections():
            result[section] = self.items(section, raw=raw, vars=vars)
        return result

    def set(self, section, option, value, filename=None,
            line_number=None, comments=None):
        """If the given section exists, set the given option to the
        specified value; otherwise raise NoSectionError.

        While it is possible to use RawConfigParser (or ConfigParser
        with raw parameters set to true) for internal storage of
        non-string values, full functionality (including interpolation
        and output to files) can only be achieved using string values.

        If self.safe_set is true, then only string values will be
        allowed.
        """
        if not isinstance(value, basestring) and self.safe_set:
            raise TypeError(
                "You can only set options to string values "
                "(you tried to set %s=%r in [%s])"
                % (option, value, section))
        sec = self.sectionxform(section)
        if sec not in self._values:
            raise NoSectionError(
                'There is no section [%s] (when setting option %r)'
                % (sec, option))
        op = self.optionxform(option)
        self._pre_normalized_keys[(sec, op)] = option
        if op in self._section_key_order[sec]:
            self._section_key_order[sec].remove(op)
        self._section_key_order[sec].append(op)
        if comments is None:
            if (sec, op) in self._key_comments:
                del self._key_comments[(sec, op)]
        else:
            self._key_comments[(sec, op)] = comments
        if filename is None:
            if (sec, op) in self._key_file_positions:
                del self._key_file_positions[(sec, op)]
        else:
            self._key_file_positions[(sec, op)] = (filename, line_number)
        self._values[sec][op] = value

    def write(self, fileobject):
        """Write a representation of the configuration to the
        specified file object.

        This representation can be parsed by a future read() call.
        """
        self.write_sources(fileobject, None)

    def write_sources(self, fileobject, sources):
        """Write a representation of the configuration, but filtered
        to only include configuration that came from `sources`.

        `sources` should be a set-like object (support ``in``) and
        any setting that came from a source included in this set will
        be written out.  Note that None is a valid source, and typical
        for settings written with ``parser.set(section, option, value)``.

        If `sources` is None, that means include settings from all
        sources.

        Note that you should be careful about non-canonical filenames.
        For instance, if a file was loaded with a relative filename,
        then you give a set that includes the same filename but in an
        absolute form, this function will not recognize them as the
        same.
        """
        f = fileobject
        if self.encoding:
            # @@: output encoding, errors?
            f = codecs.EncodedFile(f, self.encoding)
        for sec in self._section_order:
            section = self._pre_normalized_sections[sec]
            ops = self._section_key_order[sec]
            selected_ops = []
            for op in ops:
                location = self.setting_location(sec, op)
                if (sources is None
                    or location[0] in sources):
                    selected_ops.append(op)
            if not selected_ops and sources is not None:
                # Nothing in the section (at least for this file)
                continue
            comment = self._section_comments.get(sec)
            if comment:
                f.write('#'+comment+'\n')
            f.write('[%s]\n' % section)
            for op in selected_ops:
                option = self._pre_normalized_keys[(sec, op)]
                comment = self._key_comments.get((sec, op))
                if comment:
                    f.write('#'+comment+'\n')
                f.write('%s = ' % option)
                lines = self._values[sec][op].splitlines()
                if not lines:
                    lines = ['']
                f.write(lines[0])
                for line in lines[1:]:
                    f.write('\n%s%s' % (self.continuation_indent, line))
                f.write('\n')
                if comment:
                    f.write('\n')
            f.write('\n')

    def remove_option(self, section, option):
        """Remove the specified option from the specified section.

        If the section does not exist, raise NoSectionError. If the
        option existed to be removed, return True; otherwise return
        False.
        """
        sec = self.sectionxform(section)
        if sec not in self._values:
            raise NoSectionError(
                'No section [%s] (while trying to remove %r)'
                % (section, option))
        op = self.optionxform(option)
        if op in self._values[sec]:
            del self._values[sec][op]
            del self._pre_normalized_keys[(sec, op)]
            if (sec, op) in self._key_comments:
                del self._key_comments[(sec, op)]
            if (sec, op) in self._key_file_positions:
                del self._key_file_positions[(sec, op)]
            self._section_key_order[sec].remove(op)
            return True
        else:
            return False

    def remove_section(self, section):
        """Remove the specified section from the configuration.

        If the section in fact existed, return True. Otherwise return
        False.
        """
        sec = self.sectionxform(section)
        if sec not in self._values:
            return False
        for key in self._pre_normalized_keys:
            if key[0] == sec:
                del self._pre_normalized_keys[key]
        del self._pre_normalized_sections[sec]
        for key in self._key_file_positions:
            if key[0] == sec:
                del self._key_file_positions[key]
        for key in self._key_comments:
            if key[0] == sec:
                del self._key_comments[key]
        self._section_order.remove(sec)
        del self._section_key_order[sec]
        if sec in self._section_comments:
            del self._section_comments[sec]
        del self._values[sec]

    def optionxform(self, option):
        """Transforms the option name option as found in an input file
        or as passed in by client code to the form that should be used
        in the internal structures.

        The default implementation returns a lower-case version of
        option; subclasses may override this or client code can set an
        attribute of this name on instances to affect this
        behavior. Setting this to str(), for example, would make
        option names case sensitive.
        """
        if not self.case_sensitive:
            return option.lower()
        else:
            return option

    def sectionxform(self, option):
        """Transforms the section name option as found in an input file
        or as passed in by client code to the form that should be used
        in the internal structures.

        The default implementation returns a lower-case version of
        option; subclasses may override this or client code can set an
        attribute of this name on instances to affect this
        behavior. Setting this to str(), for example, would make
        option names case sensitive.
        """
        if not self.section_case_sensitive:
            return option.lower()
        else:
            return option

    def asdict(self):
        return self._values.copy()

    def sectiondict(self, section):
        return self._values.get(self.sectionxform(section), {}).copy()

class ConfigParser(RawConfigParser):

    percent_expand = True

class SafeConfigParser(ConfigParser):

    safe_set = True

class _ConfigParserParser(iniparser.INIParser):
    """
    This parser feeds the parsed values into a ConfigParser object
    """

    def __init__(self, cp, extending, map_sections=None):
        self.cp = cp
        self.extending = extending
        self.map_sections = map_sections
        self.last_comment = None
        self.section = None

    def assignment(self, name, content):
        if self.section is None and not self.cp.global_section:
            self.parse_error("Missing Section",
                             exception=MissingSectionHeaderError)
        content = content.strip(' \t')
        if not name:
            self.parse_error('No name given for option')
        if self.cp.inline_comments:
            lines = content.splitlines()
            result = []
            for line in lines:
                semi_pos = line.find(';')
                hash_pos = line.find('#')
                if semi_pos == -1 and hash_pos == -1:
                    comment = None
                elif semi_pos == -1:
                    line, comment = line.split('#', 1)
                    comment_char = '#'
                elif hash_pos == -1:
                    line, comment = line.split(';', 1)
                    comment_char = ';'
                elif hash_pos < semi_pos:
                    line, comment = line.split('#', 1)
                    comment_char = '#'
                else:
                    line, comment = line.split(';', 1)
                    comment_char = ';'
                if comment is not None:
                    line = line.rstrip()
                    comment = comment_char + ' ' + comment.lstrip()
                    self.add_comment(comment)
                result.append(line)
            content = '\n'.join(result)
        if self.extending:
            if self.cp.has_option(self.section, name):
                # Don't write over options
                return
        if self.map_sections is not None:
            if self.section in self.map_sections:
                section = self.map_sections[self.section]
            else:
                return
        else:
            section = self.section
        self.cp.set(
            section, name, content,
            filename=self.filename,
            line_number=self.lineno,
            comments=self.last_comment)
        self.last_comment = None

    def new_section(self, section):
        if not self.cp.has_section(section):
            self.cp.add_section(section, comment=self.last_comment)
            self.last_comment = None
        if not section:
            self.parse_error('Empty section name ([])')
        self.section = section

    def add_comment(self, comment):
        if self.last_comment is None:
            self.last_comment = comment
        else:
            self.last_comment = self.last_comment + '\n' + comment


class _OptionWrapper(DictMixin):

    """
    This produces the dictionary used for percent substitution in
    values.

    Substitution is recursive.
    """

    def __init__(self, parser, extra_vars, section, option,
                 _recursion):
        self.parser = parser
        self.extra_vars = extra_vars
        self.normal_extra_vars = {}
        for name, value in extra_vars.iteritems():
            self.normal_extra_vars[parser.optionxform(name)] = value
        self.section = section
        self.option = option
        self._recursion = _recursion

    def __getitem__(self, item):
        if item == '__name__':
            return self.section
        item = self.parser.optionxform(item)
        if item in self.normal_extra_vars:
            return self.normal_extra_vars[item]
        if self.parser.has_option(self.section, item):
            return self.parser.get(self.section, item,
                                   vars=self.extra_vars,
                                   _recursion=self._recursion+1)
        if item in self.parser.defaults():
            return self.parser.defaults()[item]
        raise KeyError(item)

class _SectionOptionWrapper(_OptionWrapper):
    """
    This provides the dict wrapper for dollar substitution.  Unlike
    percent substitution, you can reference values from arbitrary
    sections.
    """

    def __getitem__(self, item):
        if ':' in item:
            # Explicit section:
            section, item = item.split(':', 1)
            return self.parser.get(section, item, vars=self.extra_vars,
                                   _recursion=self._recursion+1)
        return _OptionWrapper.__getitem__(self, item)

class CanonicalFilenameSet(object):
    """
    This wrapper for a set will make sure that canonical filenames are
    used when checking for containment.

    That is, if you test ``'foo/bar' in
    CanonicalFilenameSet(['/home/user/foo/bar'])`` if the current
    working directory is ``'/home/usr/'`` then this would return True.

    This makes a filename canonical using os.path.abspath and
    os.path.normcase.
    """

    def __init__(self, s=None):
        self.set = set()
        if s is not None:
            for item in s:
                self.add(item)

    def canonical(self, item):
        if not isinstance(item, basestring):
            return item
        return os.path.normcase(os.path.abspath(item))

    def __repr__(self):
        return 'CanonicalFilenameSet(%r)' % list(self.set)

    def __contains__(self, other):
        return self.canonical(other) in self.set

    def __iter__(self):
        return iter(self.set)

    def add(self, item):
        self.set.add(self.canonical(item))

    def remove(self, item):
        self.set.remove(self.canonical(item))
